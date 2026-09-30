import { settingsManager } from '../config/settings.js';
import { memoryStore } from '../memory/memory_store.js';
import { toolRegistry } from '../tools/registry.js';

export async function buildAgentContext(userPrompt = '', sessionHistory = []) {
  const settings = settingsManager.get();

  // 1. Base persona
  let systemPrompt = settings.systemPrompt || '';
  systemPrompt += `\n\nCurrent Local System Timestamp: ${new Date().toISOString()}`;
  systemPrompt += `\nApplication Identity: ${settings.appName} | Principal: ${settings.creator}`;

  // 2. Persistent Memory Context
  const memoryContext = await memoryStore.getFormattedContextForPrompt(userPrompt);
  if (memoryContext) {
    systemPrompt += `\n${memoryContext}`;
  }

  // 3. Registered & Enabled Tools
  const availableTools = toolRegistry.getAllTools().filter(t => t.enabled);

  // 4. Formatted Message History (last 10 messages for context)
  const recentMessages = (sessionHistory || []).slice(-10);

  return {
    systemPrompt,
    availableTools,
    recentMessages,
    settings
  };
}

export default buildAgentContext;
