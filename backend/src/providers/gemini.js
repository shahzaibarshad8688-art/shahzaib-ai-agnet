import { BaseAIProvider } from './base.js';

export class GeminiProvider extends BaseAIProvider {
  constructor(config = {}) {
    super('gemini', config);
    this.apiKey = config.apiKey || process.env.GEMINI_API_KEY || '';
    this.defaultModel = config.model && config.model !== 'auto-select' ? config.model : 'gemini-2.0-flash';
  }

  getAvailableModels() {
    return [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Fastest & Multimodal)' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Deep Reasoning & Large Context)' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Lightweight & Rapid)' }
    ];
  }

  async validateCredentials() {
    if (!this.apiKey) {
      return { ok: false, message: 'Gemini API key is not configured. Please add it in Settings.' };
    }
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        return { ok: true, message: 'Gemini API connection verified successfully.' };
      }
      const err = await res.json().catch(() => ({}));
      return { ok: false, message: err?.error?.message || `HTTP ${res.status} Authentication error.` };
    } catch (err) {
      return { ok: false, message: `Failed to connect to Gemini API: ${err.message}` };
    }
  }

  async generateResponse({ messages, systemPrompt, tools = [], temperature = 0.7 }) {
    if (!this.apiKey) {
      throw new Error('Gemini API Key is missing. Configure your Gemini API key in Settings.');
    }

    const modelName = this.defaultModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;

    // Format messages for Gemini
    const contents = messages.map(msg => ({
      role: msg.role === 'agent' ? 'model' : 'user',
      parts: [{ text: msg.content || '' }]
    }));

    // Convert OpenAI-style function declarations to Gemini functionDeclarations
    const functionDeclarations = tools.map(t => {
      const fn = t.function || t;
      return {
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters
      };
    });

    const payload = {
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      contents,
      generationConfig: {
        temperature: Math.max(0, Math.min(temperature, 1.0))
      }
    };

    if (functionDeclarations.length > 0) {
      payload.tools = [{ functionDeclarations }];
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(`Gemini API Error (${response.status}): ${errData?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    let text = '';
    const toolCalls = [];

    for (const part of parts) {
      if (part.text) {
        text += part.text;
      }
      if (part.functionCall) {
        toolCalls.push({
          id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: part.functionCall.name,
          args: part.functionCall.args || {}
        });
      }
    }

    return {
      text: text.trim(),
      toolCalls,
      raw: data
    };
  }

  async generatePlan({ request, context = '', availableTools = [] }) {
    const prompt = `You are the Task Planning Engine for Shahzaib AI Agent.
Your creator and user is SHAHZAIB ARSHAD KHAGGA.
Analyze the user request and generate a structured JSON execution plan.

USER REQUEST:
"${request}"

AVAILABLE WORKSPACE & MEMORY CONTEXT:
${context}

AVAILABLE TOOLS:
${JSON.stringify(availableTools.map(t => ({ name: t.name, description: t.description })), null, 2)}

INSTRUCTIONS:
Return a valid JSON object strictly matching this schema:
{
  "reasoning": "High-level strategic rationale explaining how the goal will be achieved",
  "plan": [
    {
      "id": "step-1",
      "title": "Clear concise action label",
      "tool": "tool_name_from_available_tools (or null if purely conversational)",
      "args": { "paramKey": "paramValue" },
      "requiresConfirmation": false
    }
  ]
}
IMPORTANT: Output ONLY the raw JSON without markdown code fences or extra text.`;

    const result = await this.generateResponse({
      messages: [{ role: 'user', content: prompt }],
      systemPrompt: 'You are an advanced agentic planner. Always return clean JSON only.',
      tools: [],
      temperature: 0.2
    });

    try {
      const cleaned = result.text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        plan: parsed.plan || [],
        reasoning: parsed.reasoning || 'Plan constructed successfully.'
      };
    } catch {
      // Fallback structured plan
      return {
        plan: [
          {
            id: 'step-1',
            title: `Analyze and address: "${request.slice(0, 40)}..."`,
            tool: null,
            args: {},
            requiresConfirmation: false
          }
        ],
        reasoning: result.text
      };
    }
  }
}

export default GeminiProvider;
