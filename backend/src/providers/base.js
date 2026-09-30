/**
 * Base AI Provider Interface
 * All AI Providers (Gemini, OpenAI, Anthropic, Ollama, Deterministic) implement this contract.
 */
export class BaseAIProvider {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
  }

  /**
   * Generates a conversational or tool-augmented response from the model
   * @param {Object} options
   * @param {Array} options.messages Conversation history
   * @param {string} options.systemPrompt System instructions and persona
   * @param {Array} options.tools Available tool declarations
   * @param {number} options.temperature Sampling temperature
   * @returns {Promise<{ text: string, toolCalls?: Array, reasoning?: string }>}
   */
  async generateResponse(options) {
    throw new Error(`generateResponse() not implemented on provider "${this.name}".`);
  }

  /**
   * Asks the provider to break down a user request into sequential plan steps
   * @param {Object} options
   * @param {string} options.request User's request
   * @param {string} options.context Memory, workspace, and conversation context
   * @param {Array} options.availableTools List of registered tools
   * @returns {Promise<{ plan: Array<{ id: string, title: string, tool: string, args: Object, requiresConfirmation: boolean }>, reasoning: string }>}
   */
  async generatePlan(options) {
    throw new Error(`generatePlan() not implemented on provider "${this.name}".`);
  }

  /**
   * Validate if credentials/endpoint are functional
   */
  async validateCredentials() {
    return { ok: true, message: 'Default provider initialized' };
  }

  /**
   * Returns list of supported models for this provider
   */
  getAvailableModels() {
    return [];
  }
}

export default BaseAIProvider;
