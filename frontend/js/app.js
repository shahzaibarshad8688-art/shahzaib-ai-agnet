/**
 * Main Application Orchestrator for Shahzaib AI Agent
 * Creator: SHAHZAIB ARSHAD KHAGGA
 */

import { api } from './api.js';
import { state } from './state.js';
import { chatUI } from './ui/chat.js';
import { tasksUI } from './ui/tasks.js';
import { activityUI } from './ui/activity.js';
import { memoryUI } from './ui/memory.js';
import { toolsUI } from './ui/tools.js';
import { settingsUI } from './ui/settings.js';
import { checkpointUI } from './ui/checkpoint.js';

class ShahzaibAgentApp {
  constructor() {
    this.streamUnsubscribe = null;
  }

  async init() {
    console.log('Initializing Shahzaib AI Agent Dashboard...');

    // 1. Initialize UI sub-controllers
    chatUI.init();
    tasksUI.init();
    activityUI.init();
    memoryUI.init();
    toolsUI.init();
    settingsUI.init();
    checkpointUI.init();

    // 2. Setup navigation, inspector, and sidebar listeners
    this.setupNavigation();
    this.setupInspector();
    this.setupStatusIndicators();

    // 3. Load initial session and conversation history
    await this.loadSessions();

    console.log('Shahzaib AI Agent Dashboard ready.');
  }

  setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const viewTitle = document.getElementById('currentViewTitle');
    const sidebar = document.getElementById('sidebar');

    const titles = {
      chat: 'Workspace Chat',
      tasks: 'Tasks & Planning',
      memory: 'Persistent Memory Store',
      tools: 'Tools & Capabilities Hub',
      activity: 'Real-Time Activity Stream',
      settings: 'AI Provider & System Settings'
    };

    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const tab = item.getAttribute('data-tab');
        if (!tab) return;

        // Update nav state
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        // Switch active view panel
        document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
        const targetView = document.getElementById(`view${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
        targetView?.classList.add('active');

        if (viewTitle) viewTitle.textContent = titles[tab] || 'Workspace';
        state.set('activeTab', tab);

        // Close mobile drawer on navigation
        sidebar?.classList.remove('mobile-open');
      });
    });

    // Mobile menu button
    document.getElementById('btnMobileMenu')?.addEventListener('click', () => {
      sidebar?.classList.toggle('mobile-open');
    });

    // New Chat Button
    document.getElementById('btnNewChat')?.addEventListener('click', async () => {
      const newSession = await api.createSession('New Session');
      await this.loadSessions();
      await this.switchSession(newSession.id);
      state.addLog(`Created new session: ${newSession.id}`, 'info');
    });
  }

  setupInspector() {
    const inspector = document.getElementById('inspectorPanel');
    const toggleBtn = document.getElementById('btnToggleInspector');
    const indicator = document.getElementById('inspectorIndicator');
    const tabTasks = document.getElementById('inspectTabTasks');
    const tabActivity = document.getElementById('inspectTabActivity');
    const viewTasks = document.getElementById('inspectorTasksView');
    const viewActivity = document.getElementById('inspectorActivityView');

    toggleBtn?.addEventListener('click', () => {
      inspector?.classList.toggle('collapsed');
      const isCollapsed = inspector?.classList.contains('collapsed');
      toggleBtn.classList.toggle('active', !isCollapsed);
      if (indicator) indicator.textContent = isCollapsed ? '◀' : '▶';
    });

    tabTasks?.addEventListener('click', () => {
      tabTasks.classList.add('active');
      tabActivity?.classList.remove('active');
      if (viewTasks) viewTasks.style.display = 'block';
      if (viewActivity) viewActivity.style.display = 'none';
      state.set('inspectorTab', 'tasks');
    });

    tabActivity?.addEventListener('click', () => {
      tabActivity.classList.add('active');
      tabTasks?.classList.remove('active');
      if (viewTasks) viewTasks.style.display = 'none';
      if (viewActivity) viewActivity.style.display = 'block';
      state.set('inspectorTab', 'activity');
    });
  }

  setupStatusIndicators() {
    const dot = document.getElementById('agentStatusDot');
    const text = document.getElementById('agentStatusText');

    state.subscribe('agentStatusText', val => {
      if (text) text.textContent = val;
    });

    state.subscribe('agentStatusMode', mode => {
      if (!dot) return;
      dot.className = 'status-dot';
      if (mode === 'planning') dot.classList.add('planning');
      if (mode === 'awaiting') dot.classList.add('awaiting');
    });
  }

  async loadSessions() {
    try {
      const sessions = await api.getSessions();
      state.set('sessionsList', sessions);
      this.renderSessionsList(sessions);

      if (sessions.length > 0 && !state.get('activeSessionId')) {
        await this.switchSession(sessions[0].id);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  }

  renderSessionsList(sessions = []) {
    const listEl = document.getElementById('sessionsList');
    if (!listEl) return;
    listEl.innerHTML = '';

    const currentId = state.get('activeSessionId');

    for (const session of sessions) {
      const item = document.createElement('div');
      item.className = `session-item ${session.id === currentId ? 'active' : ''}`;
      item.innerHTML = `
        <span class="session-title" title="${escapeHtml(session.title)}">💬 ${escapeHtml(session.title)}</span>
        <button class="btn-delete-session" title="Delete conversation">✕</button>
      `;

      item.querySelector('.session-title')?.addEventListener('click', () => {
        this.switchSession(session.id);
      });

      item.querySelector('.btn-delete-session')?.addEventListener('click', async e => {
        e.stopPropagation();
        if (confirm(`Delete conversation "${session.title}"?`)) {
          await api.deleteSession(session.id);
          state.addLog(`Deleted conversation session: ${session.id}`, 'info');
          await this.loadSessions();
        }
      });

      listEl.appendChild(item);
    }
  }

  async switchSession(sessionId) {
    state.set('activeSessionId', sessionId);

    // Re-render sidebar highlights
    document.querySelectorAll('.session-item').forEach(el => el.classList.remove('active'));
    this.renderSessionsList(state.get('sessionsList'));

    // Fetch full session details
    const session = await api.getSession(sessionId);
    state.set('activeSession', session);

    // Disconnect previous SSE stream and reconnect for this session
    if (this.streamUnsubscribe) {
      this.streamUnsubscribe();
    }

    this.streamUnsubscribe = api.connectStream(
      sessionId,
      event => this.handleSSEEvent(event),
      err => console.warn('Stream notice:', err)
    );
  }

  /**
   * Real-time Server-Sent Event handler
   */
  handleSSEEvent(event) {
    if (!event || !event.type) return;

    switch (event.type) {
      case 'stream_connected':
        state.addLog(`Real-time channel connected for session [${event.sessionId}]`, 'info');
        break;

      case 'status_change':
        state.set('agentStatusText', event.message || event.status);
        if (event.status === 'planning') state.set('agentStatusMode', 'planning');
        else if (event.status === 'idle') state.set('agentStatusMode', 'idle');
        break;

      case 'plan_created':
        state.set('activePlan', {
          reasoning: event.reasoning,
          steps: event.steps
        });
        state.addLog(`Planner decomposed goal into ${event.steps?.length || 0} steps`, 'info');
        break;

      case 'step_start': {
        const curPlan = state.get('activePlan');
        if (curPlan && curPlan.steps) {
          const step = curPlan.steps.find(s => s.id === event.stepId);
          if (step) step.status = 'running';
          state.set('activePlan', { ...curPlan });
        }
        state.addLog(`[Step ${event.stepIndex}] Started: "${event.title}" ${event.tool ? `(Tool: ${event.tool})` : ''}`, 'info');
        break;
      }

      case 'checkpoint_required':
        // Trigger high-priority human authorization modal
        state.set('activeCheckpoint', event);
        state.addLog(`SECURITY CHECKPOINT: ${event.reason}`, 'warning');
        break;

      case 'checkpoint_approved': {
        const curPlan = state.get('activePlan');
        if (curPlan && curPlan.steps) {
          const step = curPlan.steps.find(s => s.id === event.stepId);
          if (step) step.status = 'running';
          state.set('activePlan', { ...curPlan });
        }
        state.addLog(`User approved checkpoint for step: ${event.stepId}`, 'success');
        break;
      }

      case 'tool_success': {
        const curPlan = state.get('activePlan');
        if (curPlan && curPlan.steps) {
          const step = curPlan.steps.find(s => s.id === event.stepId);
          if (step) {
            step.status = 'completed';
            step.result = event.result;
          }
          state.set('activePlan', { ...curPlan });
        }
        state.addLog(`Tool "${event.tool}" completed successfully (${event.executionTimeMs}ms)`, 'success');
        break;
      }

      case 'tool_error': {
        const curPlan = state.get('activePlan');
        if (curPlan && curPlan.steps) {
          const step = curPlan.steps.find(s => s.id === event.stepId);
          if (step) {
            step.status = 'failed';
            step.error = event.error;
          }
          state.set('activePlan', { ...curPlan });
        }
        state.addLog(`Tool "${event.tool}" failed: ${event.error}`, 'error');
        break;
      }

      case 'step_completed': {
        const curPlan = state.get('activePlan');
        if (curPlan && curPlan.steps) {
          const step = curPlan.steps.find(s => s.id === event.stepId);
          if (step) step.status = event.status || 'completed';
          state.set('activePlan', { ...curPlan });
        }
        break;
      }

      case 'execution_finished':
        state.set('isAgentRunning', false);
        state.set('agentStatusText', 'Online • Idle');
        state.set('agentStatusMode', 'idle');
        state.addLog(`✅ Task completed. Response synthesized.`, 'success');
        // Re-enable the send button and clear thinking bubble
        {
          const sendBtn = document.getElementById('btnSendPrompt');
          if (sendBtn) sendBtn.disabled = false;
          document.getElementById('thinkingBubble')?.remove();
        }
        // Refresh session to display the new agent message
        api.getSession(event.sessionId).then(s => state.set('activeSession', s));
        this.loadSessions();
        break;

      default:
        break;
    }
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Bootstrap on DOM load
window.addEventListener('DOMContentLoaded', () => {
  const app = new ShahzaibAgentApp();
  app.init();
});
