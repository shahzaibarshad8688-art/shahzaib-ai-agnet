import { api } from '../api.js';
import { state } from '../state.js';

export const toolsUI = {
  grid: null,
  activeTestingTool: null,

  init() {
    this.grid = document.getElementById('toolsCardsGrid');

    // Test runner modal hooks
    const modal = document.getElementById('toolTestModalOverlay');
    document.getElementById('btnCloseToolModal')?.addEventListener('click', () => {
      modal?.classList.remove('active');
    });

    document.getElementById('btnExecuteToolTest')?.addEventListener('click', () => {
      this.runDirectTest();
    });

    state.subscribe('tools', list => {
      this.renderTools(list);
    });

    this.loadTools();
  },

  async loadTools() {
    try {
      const data = await api.getTools();
      state.set('tools', data);
    } catch (err) {
      console.error('Failed to load tools:', err);
    }
  },

  renderTools(tools = []) {
    if (!this.grid) return;
    this.grid.innerHTML = '';

    for (const tool of tools) {
      const card = document.createElement('div');
      card.className = 'standard-card';

      const isEnabled = tool.enabled !== false;
      const requiresAuth = tool.requiresConfirmation;

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <span style="font-family: var(--font-code); font-size: 0.7rem; text-transform: uppercase; color: var(--neon-cyan); background: var(--neon-cyan-soft); padding: 2px 8px; border-radius: 9999px;">
              ${escapeHtml(tool.category || 'tool')}
            </span>
            <h4 style="font-family: var(--font-main); font-size: 1.05rem; color: #fff; margin-top: 8px;">
              ${escapeHtml(tool.label || tool.name)}
            </h4>
            <div style="font-family: var(--font-code); font-size: 0.74rem; color: var(--text-dim);">
              id: ${escapeHtml(tool.name)}
            </div>
          </div>

          <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
            <input type="checkbox" class="toggle-tool-chk" data-tool="${tool.name}" ${isEnabled ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
            <span class="slider" style="position: absolute; cursor: pointer; inset: 0; background: ${isEnabled ? 'var(--neon-cyan)' : '#334155'}; border-radius: 24px; transition: 0.2s;"></span>
          </label>
        </div>

        <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5;">${escapeHtml(tool.description)}</p>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 10px; border-top: 1px solid var(--border-subtle);">
          <span style="font-size: 0.74rem; font-family: var(--font-code); color: ${requiresAuth ? 'var(--status-amber)' : 'var(--status-emerald)'};">
            ${requiresAuth ? '🛡️ Auth Checkpoint' : '⚡ Safe Auto-run'}
          </span>
          <button class="chip-btn btn-test-tool" data-tool="${tool.name}">
            🧪 Test Tool
          </button>
        </div>
      `;

      // Toggle switch change
      card.querySelector('.toggle-tool-chk')?.addEventListener('change', async e => {
        const checked = e.target.checked;
        await api.toggleTool(tool.name, checked);
        state.addLog(`Toggled tool "${tool.name}" -> ${checked ? 'ENABLED' : 'DISABLED'}`, 'info');
        this.loadTools();
      });

      // Test tool button
      card.querySelector('.btn-test-tool')?.addEventListener('click', () => {
        this.openTestModal(tool);
      });

      this.grid.appendChild(card);
    }
  },

  openTestModal(tool) {
    this.activeTestingTool = tool;
    const modal = document.getElementById('toolTestModalOverlay');
    const infoDiv = document.getElementById('toolTestInfo');
    const argsInput = document.getElementById('toolTestArgsInput');
    const outputPreview = document.getElementById('toolTestOutputPreview');

    if (infoDiv) {
      infoDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <strong style="color: #fff; font-size: 1.1rem;">${escapeHtml(tool.label)}</strong>
          <span style="font-family: var(--font-code); font-size: 0.76rem; color: var(--neon-cyan);">[${tool.name}]</span>
        </div>
        <p style="font-size: 0.82rem; color: var(--text-muted);">${escapeHtml(tool.description)}</p>
      `;
    }

    // Default sample payload based on tool
    let sampleArgs = {};
    if (tool.name === 'web_search') {
      sampleArgs = { query: 'Quantum computing news 2026', maxResults: 3 };
    } else if (tool.name === 'code_runner') {
      sampleArgs = { code: 'const arr = [10, 20, 30, 40];\nconsole.log("Sum:", arr.reduce((a, b) => a + b, 0));\nreturn arr.length;' };
    } else if (tool.name === 'file_manager') {
      sampleArgs = { action: 'list', filepath: '.' };
    } else if (tool.name === 'doc_generator') {
      sampleArgs = { title: 'Test Document', format: 'markdown', content: 'Sample generated document content.' };
    } else if (tool.name === 'api_caller') {
      sampleArgs = { url: 'https://api.github.com/zen', method: 'GET' };
    } else if (tool.name === 'workflow_runner') {
      sampleArgs = { workflowType: 'workspace_audit' };
    }

    if (argsInput) {
      argsInput.value = JSON.stringify(sampleArgs, null, 2);
    }

    if (outputPreview) {
      outputPreview.textContent = 'Ready to test. Click "Run Execution Test".';
    }

    modal?.classList.add('active');
  },

  async runDirectTest() {
    if (!this.activeTestingTool) return;
    const argsInput = document.getElementById('toolTestArgsInput');
    const outputPreview = document.getElementById('toolTestOutputPreview');
    const btn = document.getElementById('btnExecuteToolTest');

    let parsedArgs = {};
    try {
      parsedArgs = JSON.parse(argsInput?.value || '{}');
    } catch (err) {
      alert(`Invalid JSON arguments: ${err.message}`);
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Executing...';
    if (outputPreview) outputPreview.textContent = 'Calling tool endpoint...';

    const startTime = Date.now();
    try {
      const response = await api.testTool(this.activeTestingTool.name, parsedArgs);
      const elapsed = Date.now() - startTime;
      if (outputPreview) {
        outputPreview.textContent = `// Completed in ${elapsed}ms\n\n` + JSON.stringify(response, null, 2);
      }
      state.addLog(`Tested tool "${this.activeTestingTool.name}" directly (${elapsed}ms)`, 'success');
    } catch (err) {
      if (outputPreview) {
        outputPreview.textContent = `// Execution Failed\n\n${err.message}`;
      }
      state.addLog(`Direct test of "${this.activeTestingTool.name}" failed: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Run Execution Test';
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

export default toolsUI;
