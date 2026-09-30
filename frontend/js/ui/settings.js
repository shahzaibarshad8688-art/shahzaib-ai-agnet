import { api } from '../api.js';
import { state } from '../state.js';

export const settingsUI = {
  providerSelect: null,
  modelInput: null,
  geminiKeyInput: null,
  openAIKeyInput: null,
  anthropicKeyInput: null,
  ollamaHostInput: null,
  requireConfirmChk: null,
  autoApproveSafeChk: null,
  systemPromptTextarea: null,
  btnSave: null,
  btnTestConn: null,
  testResultSpan: null,

  init() {
    this.providerSelect = document.getElementById('settingProviderSelect');
    this.modelInput = document.getElementById('settingModelInput');
    this.geminiKeyInput = document.getElementById('settingGeminiKey');
    this.openAIKeyInput = document.getElementById('settingOpenAIKey');
    this.anthropicKeyInput = document.getElementById('settingAnthropicKey');
    this.ollamaHostInput = document.getElementById('settingOllamaHost');
    this.requireConfirmChk = document.getElementById('settingRequireConfirmation');
    this.autoApproveSafeChk = document.getElementById('settingAutoApproveSafe');
    this.systemPromptTextarea = document.getElementById('settingSystemPrompt');
    this.btnSave = document.getElementById('btnSaveSettings');
    this.btnTestConn = document.getElementById('btnTestProviderConn');
    this.testResultSpan = document.getElementById('providerTestResult');

    this.btnSave?.addEventListener('click', () => this.saveSettings());
    this.btnTestConn?.addEventListener('click', () => this.testConnection());

    this.providerSelect?.addEventListener('change', () => {
      this.updateHeaderBadge(this.providerSelect.value);
    });

    this.loadSettings();
  },

  async loadSettings() {
    try {
      const data = await api.getSettings();
      state.set('settings', data);

      if (this.providerSelect) this.providerSelect.value = data.provider || 'deterministic';
      if (this.modelInput) this.modelInput.value = data.model || '';
      if (this.geminiKeyInput) this.geminiKeyInput.value = data.apiKeys?.gemini || '';
      if (this.openAIKeyInput) this.openAIKeyInput.value = data.apiKeys?.openai || '';
      if (this.anthropicKeyInput) this.anthropicKeyInput.value = data.apiKeys?.anthropic || '';
      if (this.ollamaHostInput) this.ollamaHostInput.value = data.apiKeys?.ollamaHost || 'http://localhost:11434';
      if (this.requireConfirmChk) this.requireConfirmChk.checked = data.requireConfirmation !== false;
      if (this.autoApproveSafeChk) this.autoApproveSafeChk.checked = data.autoApproveSafeTools !== false;
      if (this.systemPromptTextarea) this.systemPromptTextarea.value = data.systemPrompt || '';

      this.updateHeaderBadge(data.provider || 'deterministic');
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  },

  async saveSettings() {
    if (!this.btnSave) return;
    this.btnSave.disabled = true;
    this.btnSave.textContent = 'Saving...';

    const payload = {
      provider: this.providerSelect?.value || 'deterministic',
      model: this.modelInput?.value?.trim() || 'auto-select',
      requireConfirmation: Boolean(this.requireConfirmChk?.checked),
      autoApproveSafeTools: Boolean(this.autoApproveSafeChk?.checked),
      systemPrompt: this.systemPromptTextarea?.value || '',
      apiKeys: {}
    };

    // Only update keys if user provided new non-masked value
    const gKey = this.geminiKeyInput?.value?.trim();
    if (gKey && !gKey.includes('••••')) payload.apiKeys.gemini = gKey;

    const oKey = this.openAIKeyInput?.value?.trim();
    if (oKey && !oKey.includes('••••')) payload.apiKeys.openai = oKey;

    const aKey = this.anthropicKeyInput?.value?.trim();
    if (aKey && !aKey.includes('••••')) payload.apiKeys.anthropic = aKey;

    const host = this.ollamaHostInput?.value?.trim();
    if (host) payload.apiKeys.ollamaHost = host;

    try {
      const res = await api.updateSettings(payload);
      state.set('settings', res.settings);
      this.updateHeaderBadge(payload.provider);
      state.addLog(`Settings updated successfully. Active Provider: ${payload.provider}`, 'success');
      showToast('Settings saved successfully.', 'success');
    } catch (err) {
      state.addLog(`Failed to update settings: ${err.message}`, 'error');
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      this.btnSave.disabled = false;
      this.btnSave.textContent = 'Save All Settings';
    }
  },

  async testConnection() {
    const providerName = this.providerSelect?.value || 'deterministic';
    if (this.testResultSpan) {
      this.testResultSpan.textContent = 'Testing connection...';
      this.testResultSpan.style.color = 'var(--neon-cyan)';
    }

    try {
      const result = await api.testProvider(providerName);
      if (result.ok) {
        if (this.testResultSpan) {
          this.testResultSpan.textContent = `✓ ${result.message}`;
          this.testResultSpan.style.color = 'var(--status-emerald)';
        }
        state.addLog(`Provider test [${providerName}]: Success`, 'success');
      } else {
        if (this.testResultSpan) {
          this.testResultSpan.textContent = `✕ ${result.message}`;
          this.testResultSpan.style.color = 'var(--status-rose)';
        }
        state.addLog(`Provider test [${providerName}]: ${result.message}`, 'warning');
      }
    } catch (err) {
      if (this.testResultSpan) {
        this.testResultSpan.textContent = `✕ Connection error: ${err.message}`;
        this.testResultSpan.style.color = 'var(--status-rose)';
      }
    }
  },

  updateHeaderBadge(providerName) {
    const nameEl = document.getElementById('headerProviderName');
    if (!nameEl) return;

    const labels = {
      deterministic: 'Autonomous Engine (Offline Ready)',
      gemini: 'Google Gemini',
      openai: 'OpenAI GPT-4o',
      anthropic: 'Claude 3.5 Sonnet',
      ollama: 'Local Ollama'
    };

    nameEl.textContent = labels[providerName] || providerName;
  }
};

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

export default settingsUI;
