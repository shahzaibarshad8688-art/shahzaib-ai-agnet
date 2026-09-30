import { getProvider } from '../providers/index.js';
import { toolRegistry } from '../tools/registry.js';
import { settingsManager } from '../config/settings.js';

export class AgentPlanner {
  /**
   * Decompose user prompt into structured sequential execution steps
   */
  async createPlan(userRequest, context) {
    const settings = settingsManager.get();
    const provider = getProvider();
    const availableTools = context.availableTools || toolRegistry.getAllTools().filter(t => t.enabled);

    let planData;
    try {
      planData = await provider.generatePlan({
        request: userRequest,
        context: context.systemPrompt,
        availableTools
      });
    } catch (err) {
      console.warn(`Provider "${provider.name}" planning failed (${err.message}). Falling back to deterministic plan.`);
      const fallbackProvider = getProvider('deterministic');
      planData = await fallbackProvider.generatePlan({
        request: userRequest,
        context: context.systemPrompt,
        availableTools
      });
    }

    const rawSteps = Array.isArray(planData.plan) ? planData.plan : [];
    
    // Normalize and enrich each step with security checkpoint requirements
    const enrichedSteps = rawSteps.map((step, idx) => {
      const stepId = step.id || `step-${idx + 1}`;
      const toolName = step.tool || null;
      const args = step.args || {};

      let requiresConfirmation = false;
      let dangerLevel = 'safe';
      let confirmationReason = '';

      if (toolName) {
        const check = toolRegistry.shouldRequireConfirmation(toolName, args, settings);
        requiresConfirmation = Boolean(check.required);
        dangerLevel = check.dangerLevel || 'safe';
        confirmationReason = check.reason || `Tool "${toolName}" requires authorization.`;
      }

      return {
        id: stepId,
        index: idx + 1,
        title: step.title || `Action ${idx + 1}`,
        tool: toolName,
        args,
        requiresConfirmation,
        dangerLevel,
        confirmationReason,
        status: 'pending', // 'pending' | 'running' | 'completed' | 'failed' | 'awaiting_confirmation' | 'skipped'
        result: null,
        error: null,
        startedAt: null,
        completedAt: null
      };
    });

    return {
      reasoning: planData.reasoning || 'Strategic execution plan prepared.',
      steps: enrichedSteps,
      createdAt: new Date().toISOString()
    };
  }
}

export const agentPlanner = new AgentPlanner();
export default agentPlanner;
