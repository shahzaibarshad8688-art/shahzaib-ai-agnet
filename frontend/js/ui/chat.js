import { state } from '../state.js';
import { api } from '../api.js';

export const chatUI = {
  chatContainer: null,
  promptInput: null,
  btnSend: null,

  init() {
    this.chatContainer = document.getElementById('chatMessages');
    this.promptInput = document.getElementById('promptInput');
    this.btnSend = document.getElementById('btnSendPrompt');

    // Send button click
    this.btnSend?.addEventListener('click', () => this.handleSend());

    // Enter key handling (Shift+Enter = newline, Enter = submit)
    this.promptInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Auto-expand textarea
    this.promptInput?.addEventListener('input', () => {
      this.promptInput.style.height = 'auto';
      this.promptInput.style.height = Math.min(this.promptInput.scrollHeight, 160) + 'px';
    });

    // Capability chips click
    document.querySelectorAll('.chip-btn[data-prompt]').forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.getAttribute('data-prompt');
        if (text && this.promptInput) {
          this.promptInput.value = text;
          this.promptInput.focus();
          this.promptInput.style.height = 'auto';
          this.promptInput.style.height = Math.min(this.promptInput.scrollHeight, 160) + 'px';
        }
      });
    });

    // React to active session messages update
    state.subscribe('activeSession', session => {
      this.renderSession(session);
    });
  },

  async handleSend() {
    const prompt = this.promptInput?.value?.trim();
    if (!prompt || state.get('isAgentRunning')) return;

    const sessionId = state.get('activeSessionId');
    if (!sessionId) {
      this.appendErrorMessage('No active session. Please refresh the page.');
      return;
    }

    // Clear input immediately for responsive UX
    this.promptInput.value = '';
    this.promptInput.style.height = 'auto';
    this.btnSend.disabled = true;
    state.set('isAgentRunning', true);
    state.set('agentStatusText', 'Planning Strategy...');
    state.set('agentStatusMode', 'planning');

    // Optimistic user message bubble
    this.appendUserMessage(prompt);
    this.showThinkingBubble();
    this.scrollToBottom();

    state.addLog(`User: "${prompt.slice(0, 60)}${prompt.length > 60 ? '...' : ''}"`, 'info');

    try {
      // Use async=true so backend fires the agent in background while SSE delivers updates.
      // The execution_finished SSE event (in app.js handleSSEEvent) will reload the session.
      const initResult = await api.runAgent(sessionId, prompt, true);
      if (initResult.status !== 'initiated') {
        throw new Error(initResult.error || 'Agent failed to start.');
      }
      state.addLog('Agent task initiated — streaming real-time updates via SSE...', 'info');
    } catch (err) {
      console.error('Agent execution failed:', err);
      this.removeThinkingBubble();
      this.appendErrorMessage(`Execution error: ${err.message}`);
      state.addLog(`Execution failed: ${err.message}`, 'error');
      this.btnSend.disabled = false;
      state.set('isAgentRunning', false);
      state.set('agentStatusText', 'Online • Idle');
      state.set('agentStatusMode', 'idle');
    }
    // Note: btnSend is re-enabled in handleSSEEvent('execution_finished') via state subscription
  },


  renderSession(session) {
    if (!this.chatContainer) return;
    this.chatContainer.innerHTML = '';

    if (!session || !session.messages || session.messages.length === 0) {
      this.renderEmptyHero();
      return;
    }

    for (const msg of session.messages) {
      if (msg.role === 'user') {
        this.renderUserBubble(msg);
      } else {
        this.renderAgentBubble(msg);
      }
    }

    this.scrollToBottom();
  },

  renderEmptyHero() {
    const hero = document.createElement('div');
    hero.className = 'chat-empty-hero anim-fade-in-up';
    hero.innerHTML = `
      <div class="hero-insignia">⚡</div>
      <h2 class="hero-title">Shahzaib AI Agent</h2>
      <div class="hero-creator-badge">ENGINEERED FOR SHAHZAIB ARSHAD KHAGGA</div>
      <p class="hero-description">
        High-performance autonomous intelligence workspace equipped with multi-step task planning, live web research, sandboxed code execution, workspace file tools, persistent memory, and interactive confirmation checkpoints.
      </p>
      <div class="quick-starters-grid">
        <div class="quick-starter-card" data-sample="Search the web for the latest artificial intelligence breakthroughs in 2026">
          <div class="starter-title">🌐 Live Web Research</div>
          <div class="starter-desc">Investigate live queries using real-time search & scraping</div>
        </div>
        <div class="quick-starter-card" data-sample="Run code: const x = [10, 25, 30, 45]; console.log('Average:', x.reduce((a,b)=>a+b,0)/x.length);">
          <div class="starter-title">💻 Code Sandbox</div>
          <div class="starter-desc">Execute safe JavaScript algorithms with console output</div>
        </div>
        <div class="quick-starter-card" data-sample="Create file system_status.md content: # System Status\n\nShahzaib AI Agent active.">
          <div class="starter-title">📁 Workspace File System</div>
          <div class="starter-desc">Create, inspect, or manage workspace documentation</div>
        </div>
        <div class="quick-starter-card" data-sample="Generate report on Multi-Agent Autonomous Architectures">
          <div class="starter-title">📝 Document Generator</div>
          <div class="starter-desc">Produce formatted Markdown & HTML executive reports</div>
        </div>
      </div>
    `;

    hero.querySelectorAll('.quick-starter-card').forEach(card => {
      card.addEventListener('click', () => {
        const text = card.getAttribute('data-sample');
        if (text && this.promptInput) {
          this.promptInput.value = text;
          this.promptInput.focus();
          this.handleSend();
        }
      });
    });

    this.chatContainer.appendChild(hero);
  },

  renderUserBubble(msg) {
    const row = document.createElement('div');
    row.className = 'message-row user anim-fade-in-up';
    row.innerHTML = `<div class="user-bubble">${escapeHtml(msg.content)}</div>`;
    this.chatContainer.appendChild(row);
  },

  renderAgentBubble(msg) {
    const row = document.createElement('div');
    row.className = 'message-row agent anim-fade-in-up';

    let thoughtHtml = '';
    if (msg.plan && msg.plan.reasoning) {
      thoughtHtml = `
        <details class="thought-box">
          <summary class="thought-header">
            <span>🧠</span>
            <span>Reasoning & Strategy</span>
          </summary>
          <div class="thought-content">${escapeHtml(msg.plan.reasoning)}</div>
        </details>
      `;
    }

    let planHtml = '';
    if (msg.plan && Array.isArray(msg.plan.steps) && msg.plan.steps.length > 0) {
      const stepItems = msg.plan.steps.map(s => `
        <div class="inline-step-item">
          <span class="step-status-icon ${s.status === 'completed' ? 'completed' : s.status === 'running' ? 'running' : 'pending'}">
            ${s.status === 'completed' ? '✓' : s.status === 'running' ? '⟳' : '○'}
          </span>
          <span style="font-weight: 500; color: #f1f5f9;">${escapeHtml(s.title)}</span>
          ${s.tool ? `<span style="font-family: var(--font-code); font-size: 0.72rem; color: var(--neon-cyan);">[${s.tool}]</span>` : ''}
        </div>
      `).join('');

      planHtml = `
        <div class="inline-plan-card">
          <div class="inline-plan-title">
            <span>📋</span>
            <span>Decomposed Plan (${msg.plan.steps.length} Steps)</span>
          </div>
          <div class="inline-plan-steps">${stepItems}</div>
        </div>
      `;
    }

    let toolsHtml = '';
    if (Array.isArray(msg.toolsUsed) && msg.toolsUsed.length > 0) {
      toolsHtml = msg.toolsUsed.map(t => `
        <div class="tool-action-card">
          <div class="tool-action-header">
            <span class="tool-action-label">🛠️ Tool: <strong>${escapeHtml(t.tool)}</strong></span>
            <span style="font-size: 0.7rem; color: var(--status-emerald); font-weight: 600;">EXECUTED</span>
          </div>
          <div class="tool-action-output">${escapeHtml(typeof t.outputPreview === 'object' ? JSON.stringify(t.outputPreview, null, 2) : String(t.outputPreview || ''))}</div>
        </div>
      `).join('');
    }

    const formattedBody = parseMarkdown(msg.content);
    const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    row.innerHTML = `
      <div class="agent-bubble">
        <div class="agent-bubble-header">
          <div class="agent-identity">
            <div class="agent-mini-avatar">⚡</div>
            <span class="agent-name">Shahzaib AI Agent</span>
          </div>
          <span class="message-timestamp">${time}</span>
        </div>
        ${thoughtHtml}
        ${planHtml}
        ${toolsHtml}
        <div class="synthesis-content">${formattedBody}</div>
      </div>
    `;

    // Hook copy buttons on code blocks
    row.querySelectorAll('.btn-copy-code').forEach(btn => {
      btn.addEventListener('click', () => {
        const codeText = btn.getAttribute('data-code') || '';
        navigator.clipboard.writeText(codeText);
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      });
    });

    this.chatContainer.appendChild(row);
  },

  appendUserMessage(text) {
    this.renderUserBubble({ content: text });
    this.scrollToBottom();
  },

  showThinkingBubble() {
    this.removeThinkingBubble();
    const row = document.createElement('div');
    row.id = 'thinkingBubble';
    row.className = 'message-row agent anim-fade-in-up';
    row.innerHTML = `
      <div class="agent-bubble" style="max-width: 450px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="agent-mini-avatar anim-spin">⚡</div>
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <div style="font-family: var(--font-main); font-weight: 700; color: #fff; font-size: 0.9rem;">
              Shahzaib AI Agent Reasoning...
            </div>
            <div style="font-size: 0.76rem; font-family: var(--font-code); color: var(--neon-cyan);">
              Analyzing directives • Decomposing steps • Verifying tool safety
            </div>
          </div>
        </div>
      </div>
    `;
    this.chatContainer.appendChild(row);
    this.scrollToBottom();
  },

  removeThinkingBubble() {
    document.getElementById('thinkingBubble')?.remove();
  },

  appendErrorMessage(text) {
    const row = document.createElement('div');
    row.className = 'message-row agent anim-fade-in-up';
    row.innerHTML = `
      <div class="agent-bubble" style="border-color: var(--status-rose); background: rgba(244, 63, 94, 0.08);">
        <div style="color: var(--status-rose); font-weight: 600; display: flex; align-items: center; gap: 8px;">
          <span>⚠️</span>
          <span>${escapeHtml(text)}</span>
        </div>
      </div>
    `;
    this.chatContainer.appendChild(row);
    this.scrollToBottom();
  },

  scrollToBottom() {
    if (this.chatContainer) {
      this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }
  }
};

/**
 * Basic Markdown & Code Block Parser
 */
function parseMarkdown(text = '') {
  if (!text) return '';

  let html = text;

  // Code blocks ```lang ... ```
  html = html.replace(/```([a-zA-Z0-9_\-]+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const cleanLang = lang || 'code';
    const escapedCode = escapeHtml(code.trim());
    return `
      <div class="code-block-wrapper">
        <div class="code-block-header">
          <span>${cleanLang}</span>
          <button class="btn-copy-code" data-code="${escapeHtml(code.trim())}">Copy</button>
        </div>
        <pre><code>${escapedCode}</code></pre>
      </div>
    `;
  });

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Blockquotes
  html = html.replace(/^\> (.*$)/gim, '<blockquote style="border-left: 3px solid var(--neon-cyan); padding-left: 12px; margin: 8px 0; color: var(--text-muted);">$1</blockquote>');

  // Bold & Italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Bullet Lists
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, '');

  // Line breaks to paragraphs
  html = html.split('\n\n').map(p => {
    if (p.startsWith('<h') || p.startsWith('<ul') || p.startsWith('<div') || p.startsWith('<block')) {
      return p;
    }
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return html;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default chatUI;
