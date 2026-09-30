import { api } from '../api.js';
import { state } from '../state.js';

export const memoryUI = {
  grid: null,
  searchInput: null,
  activeCategory: 'all',

  init() {
    this.grid = document.getElementById('memoryCardsGrid');
    this.searchInput = document.getElementById('memorySearchInput');

    // Category filter buttons
    document.querySelectorAll('[data-memory-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-memory-cat]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeCategory = btn.getAttribute('data-memory-cat') || 'all';
        this.loadMemories();
      });
    });

    // Search input
    let searchDebounce;
    this.searchInput?.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => this.loadMemories(), 300);
    });

    // Add Memory Modal hooks
    const modal = document.getElementById('addMemoryModalOverlay');
    document.getElementById('btnOpenAddMemory')?.addEventListener('click', () => {
      modal?.classList.add('active');
    });

    document.getElementById('btnCloseMemoryModal')?.addEventListener('click', () => {
      modal?.classList.remove('active');
    });

    document.getElementById('btnCancelAddMemory')?.addEventListener('click', () => {
      modal?.classList.remove('active');
    });

    document.getElementById('btnSubmitAddMemory')?.addEventListener('click', () => {
      this.handleAddMemorySubmit();
    });

    state.subscribe('memories', list => {
      this.renderMemories(list);
    });

    this.loadMemories();
  },

  async loadMemories() {
    const query = this.searchInput?.value?.trim() || '';
    try {
      const data = await api.getMemories(query, this.activeCategory);
      state.set('memories', data);
    } catch (err) {
      console.error('Failed to load memories:', err);
    }
  },

  renderMemories(list = []) {
    if (!this.grid) return;
    this.grid.innerHTML = '';

    if (!list || list.length === 0) {
      this.grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-dim);">
          No memory entries found matching current filter.
        </div>
      `;
      return;
    }

    for (const item of list) {
      const card = document.createElement('div');
      card.className = 'standard-card';

      const tagHtml = (item.tags || []).map(t => `
        <span style="font-family: var(--font-code); font-size: 0.7rem; background: rgba(0, 240, 255, 0.08); border: 1px solid rgba(0, 240, 255, 0.2); color: var(--neon-cyan); padding: 2px 8px; border-radius: 9999px;">
          #${escapeHtml(t)}
        </span>
      `).join('');

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <span style="font-family: var(--font-code); font-size: 0.72rem; text-transform: uppercase; color: var(--electric-violet); font-weight: 700;">
            [${escapeHtml(item.category)}]
          </span>
          <button class="btn-delete-memory" data-id="${item.id}" title="Delete Memory" style="background: transparent; border: none; color: var(--text-dim); cursor: pointer; font-size: 0.85rem; padding: 2px 6px;">
            ✕
          </button>
        </div>
        <h4 style="font-family: var(--font-main); font-size: 1rem; color: #fff; margin: 2px 0;">
          ${escapeHtml(item.key)}
        </h4>
        <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; white-space: pre-wrap;">${escapeHtml(item.value)}</p>
        <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: auto; padding-top: 8px;">
          ${tagHtml}
        </div>
      `;

      card.querySelector('.btn-delete-memory')?.addEventListener('click', async e => {
        e.stopPropagation();
        if (confirm(`Delete memory note "${item.key}"?`)) {
          await api.deleteMemory(item.id);
          this.loadMemories();
          state.addLog(`Deleted memory note: "${item.key}"`, 'info');
        }
      });

      this.grid.appendChild(card);
    }
  },

  async handleAddMemorySubmit() {
    const category = document.getElementById('memInputCategory')?.value || 'facts';
    const key = document.getElementById('memInputKey')?.value?.trim();
    const value = document.getElementById('memInputValue')?.value?.trim();
    const tagsRaw = document.getElementById('memInputTags')?.value || '';

    if (!key || !value) {
      alert('Please provide both Key and Value.');
      return;
    }

    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

    try {
      await api.addMemory({ category, key, value, tags });
      document.getElementById('addMemoryModalOverlay')?.classList.remove('active');
      
      // Reset inputs
      document.getElementById('memInputKey').value = '';
      document.getElementById('memInputValue').value = '';
      document.getElementById('memInputTags').value = '';

      state.addLog(`Added new persistent memory: "${key}"`, 'success');
      this.loadMemories();
    } catch (err) {
      alert(`Failed to save memory: ${err.message}`);
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

export default memoryUI;
