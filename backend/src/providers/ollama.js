import { BaseAIProvider } from './base.js';

export class OllamaProvider extends BaseAIProvider {
  constructor(config = {}) {
    super('ollama', config);
    this.host = config.ollamaHost || process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.defaultModel = config.model && config.model !== 'auto-select' ? config.model : 'llama3';
  }

  getAvailableModels() {
    return [
      { id: 'llama3', name: 'Llama 3 (Default Local)' },
      { id: 'mistral', name: 'Mistral 7B' },
      { id: 'deepseek-r1', name: 'DeepSeek R1 (Local Reasoning)' },
      { id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder' }
    ];
  }

  async validateCredentials() {
    try {
      const res = await fetch(`${this.host}/api/tags`);
      if (res.ok) {
        const data = await res.json();
        const models = (data.models || []).map(m => m.name).join(', ') || 'No local models downloaded yet';
        return { ok: true, message: `Connected to Ollama host. Available models: ${models}` };
      }
      return { ok: false, message: `Ollama host returned HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, message: `Cannot reach Ollama at ${this.host}. Is Ollama running? (${err.message})` };
    }
  }

  async generateResponse({ messages, systemPrompt, tools = [], temperature = 0.7 }) {
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
      stream: false,
      options: {
        temperature: Math.max(0, Math.min(temperature, 1.0))
      }
    };

    const res = await fetch(`${this.host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Ollama Error (${res.status}): ${res.statusText}`);
    }

    const data = await res.json();
    return {
      text: data.message?.content || '',
      toolCalls: [],
      raw: data
    };
  }

  async generatePlan({ request, context = '', availableTools = [] }) {
    const prompt = `Decompose this task into JSON plan:
REQUEST: "${request}"
TOOLS: ${availableTools.map(t => t.name).join(', ')}
Output pure JSON: {"reasoning": "...", "plan": [{"id": "step-1", "title": "...", "tool": "...", "args": {}, "requiresConfirmation": false}]}`;

    const res = await this.generateResponse({
      messages: [{ role: 'user', content: prompt }],
      systemPrompt: 'You are an agent planner. Output JSON only.',
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

export default OllamaProvider;
