import { webSearchTool } from './web_search.js';
import { fileManagerTool } from './file_manager.js';
import { codeRunnerTool } from './code_runner.js';
import { docGeneratorTool } from './doc_generator.js';
import { apiCallerTool } from './api_caller.js';
import { workflowRunnerTool } from './workflow_runner.js';

class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.registerDefaults();
  }

  registerDefaults() {
    const list = [
      webSearchTool,
      fileManagerTool,
      codeRunnerTool,
      docGeneratorTool,
      apiCallerTool,
      workflowRunnerTool
    ];
    for (const tool of list) {
      this.tools.set(tool.name, { ...tool });
    }
  }

  getAllTools() {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      label: t.label,
      description: t.description,
      category: t.category,
      requiresConfirmation: t.requiresConfirmation,
      dangerLevel: t.dangerLevel,
      enabled: t.enabled,
      parameters: t.parameters
    }));
  }

  getTool(name) {
    return this.tools.get(name);
  }

  toggleTool(name, enabled) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool "${name}" not found.`);
    tool.enabled = Boolean(enabled);
    return tool;
  }

  /**
   * Determine if executing this tool with these arguments requires user approval
   */
  shouldRequireConfirmation(toolName, args, userPolicy = {}) {
    // If user explicitly turned off confirmations globally:
    if (userPolicy.requireConfirmation === false) {
      return { required: false };
    }

    const tool = this.tools.get(toolName);
    if (!tool) return { required: false };

    // Dynamic checkpoint inspection if defined on tool
    if (typeof tool.checkRequiresConfirmation === 'function') {
      return tool.checkRequiresConfirmation(args);
    }

    if (tool.requiresConfirmation) {
      return {
        required: true,
        dangerLevel: tool.dangerLevel || 'medium',
        reason: `Executing "${tool.label}" involves system operations or external interaction.`
      };
    }

    return { required: false, dangerLevel: 'safe' };
  }

  /**
   * Execute a tool with timing, error trapping, and activity logging
   */
  async executeTool(name, args = {}, context = {}) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool "${name}" is not registered in Shahzaib AI Agent.`);
    }

    if (!tool.enabled) {
      throw new Error(`Tool "${name}" is currently disabled in system settings.`);
    }

    const startTime = Date.now();
    try {
      const output = await tool.execute(args, context);
      const executionTimeMs = Date.now() - startTime;
      return {
        success: true,
        tool: name,
        executionTimeMs,
        result: output
      };
    } catch (err) {
      const executionTimeMs = Date.now() - startTime;
      return {
        success: false,
        tool: name,
        executionTimeMs,
        error: err.message,
        stack: err.stack
      };
    }
  }

  /**
   * Export schemas in OpenAI / Gemini compatible tool declaration format
   */
  getToolDeclarations() {
    return Array.from(this.tools.values())
      .filter(t => t.enabled)
      .map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }
      }));
  }
}

export const toolRegistry = new ToolRegistry();
export default toolRegistry;
