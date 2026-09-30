import { BaseAIProvider } from './base.js';

export class AnthropicProvider extends BaseAIProvider {
  constructor(config = {}) {
    super('anthropic', config);
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.defaultModel = config.model && config.model !== 'auto-select' ? config.model : 'claude-3-5-sonnet-20241022';
  }

  getAvailableModels() {
    return [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (State-of-the-Art Code & Reasoning)' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Lightning Rapid)' }
    ];
  }

  async validateCredentials() {
    if (!this.apiKey) {
      return { ok: false, message: 'Anthropic API key is not configured.' };
    }
    return { ok: true, message: 'Anthropic provider configured.' };
  }

  async generateResponse({ messages, systemPrompt, tools = [], temperature = 0.7 }) {
    if (!this.apiKey) {
      throw new Error('Anthropic API Key is missing. Configure it in Settings.');
    }

    const formattedMessages = messages.map(m => ({
      role: m.role === 'agent' ? 'assistant' : 'user',
      content: m.content || ''
    }));

    const anthropicTools = tools.map(t => {
      const fn = t.function || t;
      return {
        name: fn.name,
        description: fn.description,
        input_schema: fn.parameters
      };
    });

    const payload = {
      model: this.defaultModel,
      max_tokens: 4096,
      messages: formattedMessages,
      system: systemPrompt,
      temperature: Math.max(0, Math.min(temperature, 1.0))
    };

    if (anthropicTools.length > 0) {
      payload.tools = anthropicTools;
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Claude Error (${res.status}): ${err?.error?.message || res.statusText}`);
    }

    const data = await res.json();
    let text = '';
    const toolCalls = [];

    for (const block of data.content || []) {
      if (block.type === 'text') {
        text += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          args: block.input || {}
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
    const prompt = `Decompose this task into a JSON plan:
REQUEST: "${request}"
TOOLS: ${JSON.stringify(availableTools.map(t => t.name))}
OUTPUT STRICT JSON ONLY: { "reasoning": "...", "plan": [ { "id": "step-1", "title": "...", "tool": "...", "args": {}, "requiresConfirmation": false } ] }`;

    const res = await this.generateResponse({
      messages: [{ role: 'user', content: prompt }],
      systemPrompt: 'You are an agentic planner. Return strictly valid JSON with no markdown.',
      tools: [],
      temperature: 0.2
    });

    try {
      const cleaned = res.text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return {
        plan: [{ id: 'step-1', title: request.slice(0, 40), tool: null, args: {}, requiresConfirmation: false }],
        reasoning: res.text
      };
    }
  }
}

export default AnthropicProvider;
