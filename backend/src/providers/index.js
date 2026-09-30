import { GeminiProvider } from './gemini.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { OllamaProvider } from './ollama.js';
import { DeterministicProvider } from './deterministic.js';
import { settingsManager } from '../config/settings.js';

export function getProvider(customProviderName = null) {
  const settings = settingsManager.get();
  const providerName = customProviderName || settings.provider || 'deterministic';

  switch (providerName.toLowerCase()) {
    case 'gemini':
      return new GeminiProvider({
        apiKey: settings.apiKeys.gemini,
        model: settings.model
      });

    case 'openai':
      return new OpenAIProvider({
        apiKey: settings.apiKeys.openai,
        model: settings.model
      });

    case 'anthropic':
      return new AnthropicProvider({
        apiKey: settings.apiKeys.anthropic,
        model: settings.model
      });

    case 'ollama':
      return new OllamaProvider({
        ollamaHost: settings.apiKeys.ollamaHost,
        model: settings.model
      });

    case 'deterministic':
    default:
      return new DeterministicProvider({});
  }
}

export function getAllProviderInfo() {
  const settings = settingsManager.get();
  return [
    {
      id: 'deterministic',
      name: 'Autonomous Built-in Engine',
      description: 'Zero setup, offline-ready autonomous ReAct engine with intent planning and real tool execution.',
      active: settings.provider === 'deterministic',
      models: new DeterministicProvider().getAvailableModels(),
      requiresKey: false
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      description: 'Frontier Google AI models (Gemini 2.0 Flash, 1.5 Pro) with native tool use and high reasoning speed.',
      active: settings.provider === 'gemini',
      models: new GeminiProvider({}).getAvailableModels(),
      requiresKey: true,
      hasKey: Boolean(settings.apiKeys.gemini)
    },
    {
      id: 'openai',
      name: 'OpenAI',
      description: 'Industry-standard GPT-4o, GPT-4o Mini, and o3-mini models.',
      active: settings.provider === 'openai',
      models: new OpenAIProvider({}).getAvailableModels(),
      requiresKey: true,
      hasKey: Boolean(settings.apiKeys.openai)
    },
    {
      id: 'anthropic',
      name: 'Anthropic Claude',
      description: 'Claude 3.5 Sonnet and Haiku for superior coding accuracy and agentic workflows.',
      active: settings.provider === 'anthropic',
      models: new AnthropicProvider({}).getAvailableModels(),
      requiresKey: true,
      hasKey: Boolean(settings.apiKeys.anthropic)
    },
    {
      id: 'ollama',
      name: 'Local Ollama',
      description: 'Self-hosted local models (Llama 3, Mistral, DeepSeek) with complete privacy.',
      active: settings.provider === 'ollama',
      models: new OllamaProvider({}).getAvailableModels(),
      requiresKey: false,
      host: settings.apiKeys.ollamaHost || 'http://localhost:11434'
    }
  ];
}

export default { getProvider, getAllProviderInfo };
