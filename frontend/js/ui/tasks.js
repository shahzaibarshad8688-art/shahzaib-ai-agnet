import { state } from '../state.js';

export const tasksUI = {
  inspectorTasksView: null,
  fullTasksContainer: null,

  init() {
    this.inspectorTasksView = document.getElementById('inspectorTasksView');
    this.fullTasksContainer = document.getElementById('fullTasksContainer');

    // Subscribe to plan changes in state
    state.subscribe('activePlan', plan => {
      this.renderPlan(plan);
    });

    // Also update when activeSession changes
    state.subscribe('activeSession', session => {
      if (session?.activeTasks && session.activeTasks.length > 0) {
        this.renderPlan({
          reasoning: 'Active session tasks plan.',
          steps: session.activeTasks
        });
      }
    });
  },

  renderPlan(plan) {
    if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) {
      const emptyHtml = `
        <div style="text-align: center; padding: 40px 10px; color: var(--text-dim); display: flex; flex-direction: column; align-items: center; gap: 10px;">
          <div style="font-size: 2rem;">📋</div>
          <div style="font-family: var(--font-main); font-weight: 600; color: var(--text-muted); font-size: 0.95rem;">No Active Task Plan</div>
          <div style="font-size: 0.8rem; max-width: 260px; line-height: 1.4;">Direct Shahzaib AI Agent in the workspace to see real-time task decomposition and step execution.</div>
        </div>
      `;
      if (this.inspectorTasksView) this.inspectorTasksView.innerHTML = emptyHtml;
      if (this.fullTasksContainer) this.fullTasksContainer.innerHTML = emptyHtml;
      return;
    }

    const steps = plan.steps;
    const completedCount = steps.filter(s => s.status === 'completed').length;
    const totalCount = steps.length;
    const progressPercent = Math.round((completedCount / totalCount) * 100);

    const summaryCardHtml = `
      <div class="plan-summary-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-family: var(--font-main); font-weight: 700; color: #fff; font-size: 0.95rem;">Goal Strategy</span>
          <span style="font-family: var(--font-code); font-size: 0.8rem; color: var(--neon-cyan); font-weight: 600;">${completedCount}/${totalCount} Steps (${progressPercent}%)</span>
        </div>
        ${plan.reasoning ? `<div class="plan-reasoning">${escapeHtml(plan.reasoning)}</div>` : ''}
        <div class="plan-progress-bar-bg">
          <div class="plan-progress-fill" style="width: ${progressPercent}%;"></div>
        </div>
      </div>
    `;

    const stepsHtml = steps.map((s, idx) => {
      const statusClass = s.status || 'pending';
      const isRunning = statusClass === 'running';
      const isAwaiting = statusClass === 'awaiting_confirmation';

      return `
        <div class="task-step-card ${isRunning ? 'active' : ''} ${isAwaiting ? 'awaiting' : ''}" id="stepCard_${s.id}">
          <div class="step-card-header">
            <div class="step-title-row">
              <span class="step-status-icon ${statusClass}">
                ${statusClass === 'completed' ? '✓' : isRunning ? '⟳' : isAwaiting ? '🛡️' : statusClass === 'failed' ? '✕' : `${idx + 1}`}
              </span>
              <strong style="color: #fff; font-size: 0.88rem;">${escapeHtml(s.title)}</strong>
            </div>
            <span class="step-badge badge-${statusClass}">
              ${isAwaiting ? 'Awaiting Auth' : statusClass}
            </span>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.76rem; color: var(--text-dim); margin-top: 2px;">
            ${s.tool ? `<span style="font-family: var(--font-code); color: var(--neon-cyan);">Tool: ${s.tool}</span>` : '<span>Internal Reasoning</span>'}
            ${s.requiresConfirmation ? `<span style="color: var(--status-amber); font-weight: 600;">⚠️ Checkpoint</span>` : ''}
          </div>

          ${s.args && Object.keys(s.args).length > 0 ? `
            <details style="margin-top: 4px; font-size: 0.74rem;">
              <summary style="cursor: pointer; color: var(--text-dim); user-select: none;">View Arguments</summary>
              <pre style="background: #060911; padding: 6px 8px; border-radius: 4px; margin-top: 4px; color: #94a3b8; font-family: var(--font-code); overflow-x: auto;">${escapeHtml(JSON.stringify(s.args, null, 2))}</pre>
            </details>
          ` : ''}
        </div>
      `;
    }).join('');

    const fullHtml = `
      <div class="tasks-container">
        ${summaryCardHtml}
        <div class="task-steps-list">
          ${stepsHtml}
        </div>
      </div>
    `;

    if (this.inspectorTasksView) this.inspectorTasksView.innerHTML = fullHtml;
    if (this.fullTasksContainer) this.fullTasksContainer.innerHTML = fullHtml;
  }
};

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default tasksUI;
