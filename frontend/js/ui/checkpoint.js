import { api } from '../api.js';
import { state } from '../state.js';

export const checkpointUI = {
  overlay: null,
  titleEl: null,
  reasonEl: null,
  argsPreviewEl: null,
  dangerTagEl: null,
  chkAutoApprove: null,
  btnApprove: null,
  btnReject: null,
  currentCheckpoint: null,

  init() {
    this.overlay = document.getElementById('checkpointOverlay');
    this.titleEl = document.getElementById('checkpointTitle');
    this.reasonEl = document.getElementById('checkpointReason');
    this.argsPreviewEl = document.getElementById('checkpointArgsPreview');
    this.dangerTagEl = document.getElementById('checkpointDangerTag');
    this.chkAutoApprove = document.getElementById('chkAutoApproveSession');
    this.btnApprove = document.getElementById('btnApproveCheckpoint');
    this.btnReject = document.getElementById('btnRejectCheckpoint');

    this.btnApprove?.addEventListener('click', () => this.handleDecision(true));
    this.btnReject?.addEventListener('click', () => this.handleDecision(false));

    state.subscribe('activeCheckpoint', cp => {
      if (cp) {
        this.showCheckpoint(cp);
      } else {
        this.hideCheckpoint();
      }
    });
  },

  showCheckpoint(cp) {
    this.currentCheckpoint = cp;
    if (!this.overlay) return;

    if (this.titleEl) {
      this.titleEl.textContent = `Authorization: ${cp.tool || 'Action'}`;
    }
    if (this.reasonEl) {
      this.reasonEl.textContent = cp.reason || 'Agent requires human confirmation prior to executing this action.';
    }
    if (this.argsPreviewEl) {
      this.argsPreviewEl.textContent = JSON.stringify(cp.args || {}, null, 2);
    }
    if (this.dangerTagEl) {
      const level = (cp.dangerLevel || 'medium').toUpperCase();
      this.dangerTagEl.textContent = `SECURITY CHECKPOINT • RISK LEVEL: ${level}`;
      this.dangerTagEl.style.color = level === 'HIGH' ? 'var(--status-rose)' : 'var(--status-amber)';
    }

    if (this.chkAutoApprove) {
      this.chkAutoApprove.checked = false;
    }

    this.overlay.classList.add('active');
    state.set('agentStatusText', 'Awaiting Human Authorization...');
    state.set('agentStatusMode', 'awaiting');
    state.addLog(`CHECKPOINT TRIGGERED: Authorization requested for tool "${cp.tool}"`, 'warning');
  },

  hideCheckpoint() {
    this.currentCheckpoint = null;
    this.overlay?.classList.remove('active');
  },

  async handleDecision(approved) {
    if (!this.currentCheckpoint) return;

    const checkpointId = this.currentCheckpoint.checkpointId;
    const autoApprove = Boolean(this.chkAutoApprove?.checked);

    this.hideCheckpoint();

    try {
      await api.confirmCheckpoint({
        checkpointId,
        approved,
        autoApproveSession: autoApprove,
        notes: approved ? 'Approved by user via dashboard' : 'Declined by user'
      });

      state.addLog(`Checkpoint [${checkpointId}]: ${approved ? 'APPROVED' : 'REJECTED'} by user`, approved ? 'success' : 'error');
    } catch (err) {
      console.error('Error confirming checkpoint:', err);
      state.addLog(`Failed to submit checkpoint decision: ${err.message}`, 'error');
    }
  }
};

export default checkpointUI;
