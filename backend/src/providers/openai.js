import { BaseAIProvider } from './base.js';

export class OpenAIProvider extends BaseAIProvider {
  constructor(config = {}) {
    super('openai', config);
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';
    this.defaultModel = config.model && config.model !== 'auto-select' ? config.model : 'gpt-4o';
  }

  getAvailableModels() {
    return [
      { id: 'gpt-4o', name: 'GPT-4o (Flagship Omni Model)' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast & Cost Efficient)' },
      { id: 'o3-mini', name: 'o3-mini (High-tier Reasoning Engine)' }
    ];
  }

  async validateCredentials() {
    if (!this.apiKey) {
      return { ok: false, message: 'OpenAI API key is missing. Please add it in Settings.' };
    }
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${this.apiKey}` }
      });
      if (res.ok) {
        return { ok: true, message: 'OpenAI credentials validated successfully.' };
      }
      const err = await res.json().catch(() => ({}));
      return { ok: false, message: err?.error?.message || `HTTP ${res.status} Authentication error.` };
    } catch (err) {
      return { ok: false, message: `Failed to connect to OpenAI: ${err.message}` };
    }
  }

  async generateResponse({ messages, systemPrompt, tools = [], temperature = 0.7 }) {
    if (!this.apiKey) {
      throw new Error('OpenAI API Key is missing. Configure it in Settings.');
    }

    const formattedMessages = [];
    if (systemPrompt) {
      formattedMessages.push({ role: 'system', content: systemPrompt });
    }
    for (const m of messages) {
      formattedMessages.push({
        role: m.role === 'agent' ? 'assistant' : m.role,
        content: m.content || ''
      });
    }

    const payload = {
      model: this.defaultModel,
      messages: formattedMessages,
      temperature: Math.max(0, Math.min(temperature, 1.0))
    };

    if (tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`OpenAI Error (${res.status}): ${err?.error?.message || res.statusText}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const msg = choice?.message;

    const toolCalls = [];
    if (msg?.tool_calls) {
      for (const tc of msg.tool_calls) {
        let parsedArgs = {};
        try {
          parsedArgs = JSON.parse(tc.function.arguments);
        } catch {
          parsedArgs = { raw: tc.function.arguments };
        }
        toolCalls.push({
          id: tc.id,
          name: tc.function.name,
          args: parsedArgs
        });
      }
    }

    return {
      text: msg?.content || '',
      toolCalls,
      raw: data
    };
  }

  async generatePlan({ request, context = '', availableTools = [] }) {
    const prompt = `You are the Agentic Planning Engine for Shahzaib AI Agent (Creator: SHAHZAIB ARSHAD KHAGGA).
Decompose this user request into a step-by-step tool plan.

USER REQUEST:
"${request}"

CONTEXT:
${context}

TOOLS:
${JSON.stringify(availableTools.map(t => ({ name: t.name, description: t.description })), null, 2)}

Provide JSON response only:
{
  "reasoning": "Strategy explanation",
  "plan": [
    {
      "id": "step-1",
      "title": "Short title",
      "tool": "tool_name or null",
      "args": {},
      "requiresConfirmation": false
    }
  ]
}`;

    const res = await this.generateResponse({
      messages: [{ role: 'user', content: prompt }],
      systemPrompt: 'You output pure JSON with no markdown wrapping.',
      tools: [],
      temperature: 0.2
    });

    try {
      const cleaned = res.text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        plan: parsed.plan || [],
        reasoning: parsed.reasoning || ''
      };
    } catch {
      return {
        plan: [
          {
            id: 'step-1',
            title: `Process: "${request.slice(0, 40)}"`,
            tool: null,
            args: {},
            requiresConfirmation: false
          }
        ],
        reasoning: res.text
      };
    }
  }
}

export default OpenAIProvider;
