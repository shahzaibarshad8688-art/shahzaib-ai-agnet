import { state } from '../state.js';

export const activityUI = {
  miniStream: null,
  fullStream: null,

  init() {
    this.miniStream = document.getElementById('miniActivityStream');
    this.fullStream = document.getElementById('fullActivityStream');

    document.getElementById('btnClearActivityLogs')?.addEventListener('click', () => {
      state.set('activityLogs', []);
    });

    state.subscribe('activityLogs', logs => {
      this.renderLogs(logs);
    });

    // Initial boot log
    state.addLog('🚀 Shahzaib AI Agent initialized. Connected to local gateway (http://localhost:3000).', 'success');
  },

  renderLogs(logs = []) {
    if (!logs || logs.length === 0) {
      const emptyMsg = `<div style="color: var(--text-dim); padding: 20px; text-align: center; font-size: 0.82rem;">No activity events recorded yet.</div>`;
      if (this.miniStream) this.miniStream.innerHTML = emptyMsg;
      if (this.fullStream) this.fullStream.innerHTML = emptyMsg;
      return;
    }

    const levelIcon = { info: 'ℹ', success: '✓', warning: '⚠', error: '✕' };

    const html = logs.map(l => `
      <div class="log-entry ${l.level || 'info'}">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <span class="log-time">${l.time}</span>
          <span style="font-size: 0.65rem; text-transform: uppercase; opacity: 0.7;">${levelIcon[l.level] || '·'} ${l.level}</span>
        </div>
        <div class="log-msg">${escapeHtml(l.message)}</div>
      </div>
    `).join('');

    if (this.miniStream) {
      this.miniStream.innerHTML = html;
      // Auto-scroll to top (newest entry is first)
      this.miniStream.scrollTop = 0;
    }
    if (this.fullStream) {
      this.fullStream.innerHTML = html;
      this.fullStream.scrollTop = 0;
    }
  }
};

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default activityUI;
