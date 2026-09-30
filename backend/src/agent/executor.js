import crypto from 'node:crypto';
import { agentPlanner } from './planner.js';
import { buildAgentContext } from './context.js';
import { toolRegistry } from '../tools/registry.js';
import { getProvider } from '../providers/index.js';
import { historyStore } from '../memory/history_store.js';
import { settingsManager } from '../config/settings.js';

class AgentExecutor {
  constructor() {
    // Checkpoints waiting for human approval: checkpointId -> CheckpointRecord
    this.pendingCheckpoints = new Map();
    // Active streams: sessionId -> Array of Event listeners
    this.eventListeners = new Map();
    // Auto-approved sessions whitelist (if user clicked "Always approve in this session")
    this.sessionAutoApproved = new Set();
  }

  /**
   * Subscribe to real-time agent execution events for a session
   */
  subscribe(sessionId, callback) {
    if (!this.eventListeners.has(sessionId)) {
      this.eventListeners.set(sessionId, new Set());
    }
    const set = this.eventListeners.get(sessionId);
    set.add(callback);

    return () => {
      set.delete(callback);
      if (set.size === 0) this.eventListeners.delete(sessionId);
    };
  }

  /**
   * Broadcast event to all subscribers of this session
   */
  emit(sessionId, eventType, data = {}) {
    const listeners = this.eventListeners.get(sessionId);
    const eventPayload = {
      type: eventType,
      sessionId,
      timestamp: new Date().toISOString(),
      ...data
    };

    if (listeners && listeners.size > 0) {
      for (const listener of listeners) {
        try {
          listener(eventPayload);
        } catch (err) {
          console.error('Error in session event listener:', err);
        }
      }
    }

    return eventPayload;
  }

  /**
   * Main entry point to run an agent workflow for a user request
   */
  async execute({ sessionId, userPrompt }) {
    const session = await historyStore.getSession(sessionId);
    const context = await buildAgentContext(userPrompt, session.messages);
    const settings = settingsManager.get();

    // 1. Record user message in history
    const userMsg = await historyStore.addMessage(sessionId, {
      role: 'user',
      content: userPrompt
    });

    this.emit(sessionId, 'user_message', { message: userMsg });

    // 2. Planning phase
    this.emit(sessionId, 'status_change', { status: 'planning', message: 'Decomposing request into strategic steps...' });
    
    let planResult;
    try {
      planResult = await agentPlanner.createPlan(userPrompt, context);
    } catch (err) {
      console.error('Planning error:', err);
      planResult = {
        reasoning: 'Direct fallback execution.',
        steps: [
          {
            id: 'step-1',
            index: 1,
            title: 'Analyze and respond to user query',
            tool: null,
            args: {},
            requiresConfirmation: false,
            dangerLevel: 'safe',
            status: 'pending'
          }
        ]
      };
    }

    // Save active tasks to session
    await historyStore.updateSessionTasks(sessionId, planResult.steps);
    this.emit(sessionId, 'plan_created', {
      reasoning: planResult.reasoning,
      steps: planResult.steps
    });

    // 3. Execution loop
    const toolResults = [];

    for (let i = 0; i < planResult.steps.length; i++) {
      const step = planResult.steps[i];
      step.status = 'running';
      step.startedAt = new Date().toISOString();
      await historyStore.updateSessionTasks(sessionId, planResult.steps);

      this.emit(sessionId, 'step_start', {
        stepId: step.id,
        stepIndex: step.index,
        title: step.title,
        tool: step.tool,
        args: step.args
      });

      // Pure conversational step (no tool)
      if (!step.tool) {
        step.status = 'completed';
        step.completedAt = new Date().toISOString();
        await historyStore.updateSessionTasks(sessionId, planResult.steps);
        this.emit(sessionId, 'step_completed', { stepId: step.id, result: 'Conversational reasoning complete' });
        continue;
      }

      // Check if this step requires confirmation
      const isSessionAutoApproved = this.sessionAutoApproved.has(sessionId);
      if (step.requiresConfirmation && !isSessionAutoApproved && settings.requireConfirmation !== false) {
        step.status = 'awaiting_confirmation';
        await historyStore.updateSessionTasks(sessionId, planResult.steps);

        const checkpointId = `chk_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        
        // Broadcast checkpoint required event
        this.emit(sessionId, 'checkpoint_required', {
          checkpointId,
          stepId: step.id,
          stepIndex: step.index,
          tool: step.tool,
          args: step.args,
          dangerLevel: step.dangerLevel,
          reason: step.confirmationReason || `Operation on tool "${step.tool}" requires user authorization.`
        });

        // Wait for human authorization via Promise
        const userApproval = await new Promise(resolve => {
          this.pendingCheckpoints.set(checkpointId, {
            sessionId,
            stepId: step.id,
            resolve
          });
        });

        this.pendingCheckpoints.delete(checkpointId);

        if (!userApproval.approved) {
          step.status = 'skipped';
          step.completedAt = new Date().toISOString();
          step.error = `Action cancelled by user: ${userApproval.notes || 'Human authorization declined'}`;
          await historyStore.updateSessionTasks(sessionId, planResult.steps);
          this.emit(sessionId, 'step_skipped', { stepId: step.id, reason: step.error });
          continue;
        }

        if (userApproval.autoApproveSession) {
          this.sessionAutoApproved.add(sessionId);
        }

        step.status = 'running';
        await historyStore.updateSessionTasks(sessionId, planResult.steps);
        this.emit(sessionId, 'checkpoint_approved', { stepId: step.id });
      }

      // Execute tool
      this.emit(sessionId, 'status_change', {
        status: 'executing_tool',
        tool: step.tool,
        message: `Executing tool: ${step.tool}`
      });

      try {
        const toolExecution = await toolRegistry.executeTool(step.tool, step.args, {
          sessionId,
          userPrompt
        });

        if (toolExecution.success) {
          step.status = 'completed';
          step.result = toolExecution.result;
          step.completedAt = new Date().toISOString();
          toolResults.push({
            tool: step.tool,
            title: step.title,
            args: step.args,
            output: toolExecution.result
          });
          this.emit(sessionId, 'tool_success', {
            stepId: step.id,
            tool: step.tool,
            executionTimeMs: toolExecution.executionTimeMs,
            result: toolExecution.result
          });
        } else {
          step.status = 'failed';
          step.error = toolExecution.error;
          step.completedAt = new Date().toISOString();
          this.emit(sessionId, 'tool_error', {
            stepId: step.id,
            tool: step.tool,
            error: toolExecution.error
          });
        }
      } catch (err) {
        step.status = 'failed';
        step.error = err.message;
        step.completedAt = new Date().toISOString();
        this.emit(sessionId, 'tool_error', {
          stepId: step.id,
          tool: step.tool,
          error: err.message
        });
      }

      await historyStore.updateSessionTasks(sessionId, planResult.steps);
      this.emit(sessionId, 'step_completed', {
        stepId: step.id,
        status: step.status,
        result: step.result,
        error: step.error
      });
    }

    // 4. Synthesis Phase
    this.emit(sessionId, 'status_change', { status: 'synthesizing', message: 'Synthesizing final strategic response...' });

    let finalContent = '';
    const provider = getProvider();

    if (provider.name !== 'deterministic') {
      try {
        const synthPrompt = `You are Shahzaib AI Agent (Creator: SHAHZAIB ARSHAD KHAGGA).
The user requested: "${userPrompt}"

The following tools were executed with genuine results:
${JSON.stringify(toolResults, null, 2)}

Provide a comprehensive, authoritative, beautifully structured markdown response for SHAHZAIB ARSHAD KHAGGA.
Directly synthesize the real data found, summarize outcomes, link references if available, and provide clear next steps.`;

        const responseObj = await provider.generateResponse({
          messages: [...context.recentMessages, { role: 'user', content: synthPrompt }],
          systemPrompt: context.systemPrompt,
          temperature: settings.temperature
        });
        finalContent = responseObj.text;
      } catch (err) {
        console.warn('Synthesis with external provider failed:', err.message);
        finalContent = formatAutonomousSynthesis(userPrompt, planResult, toolResults);
      }
    } else {
      finalContent = formatAutonomousSynthesis(userPrompt, planResult, toolResults);
    }

    // 5. Save Agent Response to History
    const agentMsg = await historyStore.addMessage(sessionId, {
      role: 'agent',
      content: finalContent,
      plan: planResult,
      toolsUsed: toolResults.map(t => ({
        tool: t.tool,
        title: t.title,
        outputPreview: t.output
      }))
    });

    this.emit(sessionId, 'status_change', { status: 'idle', message: 'Agent idle and ready.' });
    this.emit(sessionId, 'execution_finished', {
      message: agentMsg,
      plan: planResult,
      toolsUsedCount: toolResults.length
    });

    return {
      message: agentMsg,
      plan: planResult,
      toolsUsed: toolResults
    };
  }

  /**
   * Handle human authorization checkpoint decision
   */
  resolveCheckpoint(checkpointId, decision) {
    const checkpoint = this.pendingCheckpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint "${checkpointId}" not found or already expired.`);
    }

    checkpoint.resolve({
      approved: Boolean(decision.approved),
      autoApproveSession: Boolean(decision.autoApproveSession),
      notes: decision.notes || ''
    });

    return { success: true, checkpointId };
  }

  getPendingCheckpoints() {
    const list = [];
    for (const [id, cp] of this.pendingCheckpoints.entries()) {
      list.push({
        checkpointId: id,
        sessionId: cp.sessionId,
        stepId: cp.stepId
      });
    }
    return list;
  }
}

/**
 * Format structured synthesis for autonomous engine
 */
function formatAutonomousSynthesis(userPrompt, plan, toolResults) {
  let out = `### Task Synthesis\n\nI have completed the planned actions for: **"${userPrompt}"**.\n\n`;

  if (toolResults.length > 0) {
    out += `#### Tool Execution Summary:\n\n`;
    for (const t of toolResults) {
      out += `- **${t.title}** (\`${t.tool}\`):\n`;
      
      if (t.tool === 'web_search') {
        const hits = t.output?.results || [];
        out += `  - Retrieved **${t.output?.resultsCount || 0}** live web results.\n`;
        for (const hit of hits.slice(0, 3)) {
          out += `  - 🌐 [${hit.title}](${hit.url}): ${hit.snippet}\n`;
        }
      } else if (t.tool === 'file_manager') {
        if (t.output?.action === 'list') {
          out += `  - Total files in workspace: **${t.output?.totalFiles}**\n`;
          for (const f of (t.output?.files || []).slice(0, 5)) {
            out += `    - \`${f.name}\` (${f.size} bytes)\n`;
          }
        } else if (t.output?.action === 'write') {
          out += `  - 💾 ${t.output?.message} (${t.output?.bytesWritten} bytes)\n`;
        } else if (t.output?.action === 'read') {
          out += `  - 📄 Content read from \`${t.output?.filepath}\` (${t.output?.bytes} bytes):\n`;
          out += `\`\`\`\n${(t.output?.content || '').slice(0, 400)}\n\`\`\`\n`;
        } else {
          out += `  - ${JSON.stringify(t.output)}\n`;
        }
      } else if (t.tool === 'code_runner') {
        out += `  - ⏱️ Execution time: **${t.output?.durationMs}ms**\n`;
        if (t.output?.status === 'success') {
          out += `  - Return Value: \`${t.output?.returnValue}\`\n`;
          if (t.output?.consoleLogs?.length) {
            out += `  - Console Output:\n\`\`\`\n${t.output.consoleLogs.join('\n')}\n\`\`\`\n`;
          }
        } else {
          out += `  - ❌ Execution Error: \`${t.output?.errorMessage}\`\n`;
        }
      } else if (t.tool === 'doc_generator') {
        out += `  - 📝 Created document: \`${t.output?.filename}\` (${t.output?.wordCount} words)\n`;
        out += `  - Preview:\n> ${t.output?.preview?.slice(0, 200)}...\n`;
      } else if (t.tool === 'api_caller') {
        out += `  - HTTP Status: **${t.output?.statusCode} ${t.output?.statusText || ''}** (${t.output?.durationMs}ms)\n`;
        out += `  - Response Preview:\n\`\`\`json\n${JSON.stringify(t.output?.data, null, 2)?.slice(0, 400)}\n\`\`\`\n`;
      } else if (t.tool === 'workflow_runner') {
        out += `  - Workflow **${t.output?.workflow}** executed successfully.\n`;
        for (const traceLine of t.output?.trace || []) {
          out += `    - ${traceLine}\n`;
        }
      } else {
        out += `  - Result: ${JSON.stringify(t.output).slice(0, 300)}\n`;
      }
      out += `\n`;
    }
  } else {
    out += `Completed conversational analysis without tool invocation. All systems operational.\n\n`;
  }

  out += `---\n*Prepared for **SHAHZAIB ARSHAD KHAGGA** by **Shahzaib AI Agent***\n`;
  return out;
}

export const agentExecutor = new AgentExecutor();
export default agentExecutor;
