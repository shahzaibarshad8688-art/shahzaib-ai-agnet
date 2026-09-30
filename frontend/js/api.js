/**
 * API Client Service for Shahzaib AI Agent
 * All requests are routed to the local Express backend at http://localhost:3000
 */

// When served from the backend (http://localhost:PORT), '/api' is correct.
// If somehow opened via file:// protocol, fall back to absolute localhost URL.
const API_BASE = (() => {
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return 'http://localhost:3000/api';
  }
  return '/api';
})();

export const api = {
  // System Health
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return res.json();
  },

  // Settings
  async getSettings() {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error(`Settings fetch failed: ${res.status}`);
    return res.json();
  },

  async updateSettings(settings) {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (!res.ok) throw new Error(`Settings update failed: ${res.status}`);
    return res.json();
  },

  // Providers
  async getProviders() {
    const res = await fetch(`${API_BASE}/providers`);
    if (!res.ok) throw new Error(`Providers fetch failed: ${res.status}`);
    return res.json();
  },

  async testProvider(providerName) {
    const res = await fetch(`${API_BASE}/providers/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerName })
    });
    if (!res.ok) throw new Error(`Provider test failed: ${res.status}`);
    return res.json();
  },

  // Sessions
  async getSessions() {
    const res = await fetch(`${API_BASE}/sessions`);
    if (!res.ok) throw new Error(`Sessions fetch failed: ${res.status}`);
    return res.json();
  },

  async createSession(title) {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    if (!res.ok) throw new Error(`Session creation failed: ${res.status}`);
    return res.json();
  },

  async getSession(id) {
    const res = await fetch(`${API_BASE}/sessions/${id}`);
    if (!res.ok) throw new Error(`Session fetch failed: ${res.status} for id=${id}`);
    return res.json();
  },

  async deleteSession(id) {
    const res = await fetch(`${API_BASE}/sessions/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(`Session delete failed: ${res.status}`);
    return res.json();
  },

  // Agent Execution
  async runAgent(sessionId, prompt, isAsync = false) {
    const res = await fetch(`${API_BASE}/agent/run?async=${isAsync}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, prompt })
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(errBody.error || `Agent run failed: ${res.status}`);
    }
    return res.json();
  },

  // Safety Checkpoints
  async confirmCheckpoint({ checkpointId, approved, autoApproveSession = false, notes = '' }) {
    const res = await fetch(`${API_BASE}/agent/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkpointId, approved, autoApproveSession, notes })
    });
    if (!res.ok) throw new Error(`Checkpoint confirm failed: ${res.status}`);
    return res.json();
  },

  // Tools
  async getTools() {
    const res = await fetch(`${API_BASE}/tools`);
    if (!res.ok) throw new Error(`Tools fetch failed: ${res.status}`);
    return res.json();
  },

  async toggleTool(name, enabled) {
    const res = await fetch(`${API_BASE}/tools/${name}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    if (!res.ok) throw new Error(`Tool toggle failed: ${res.status}`);
    return res.json();
  },

  async testTool(name, args) {
    const res = await fetch(`${API_BASE}/tools/${name}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args })
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(errBody.error || `Tool test failed: ${res.status}`);
    }
    return res.json();
  },

  // Memory
  async getMemories(query = '', category = '') {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (category && category !== 'all') params.append('category', category);
    const res = await fetch(`${API_BASE}/memory?${params.toString()}`);
    if (!res.ok) throw new Error(`Memory fetch failed: ${res.status}`);
    return res.json();
  },

  async addMemory(entry) {
    const res = await fetch(`${API_BASE}/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    if (!res.ok) throw new Error(`Memory add failed: ${res.status}`);
    return res.json();
  },

  async deleteMemory(id) {
    const res = await fetch(`${API_BASE}/memory/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(`Memory delete failed: ${res.status}`);
    return res.json();
  },

  // Real-time Server-Sent Events (SSE) Stream
  connectStream(sessionId, onEvent, onError) {
    const url = `${API_BASE}/agent/stream/${sessionId}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = event => {
      try {
        const payload = JSON.parse(event.data);
        if (typeof onEvent === 'function') {
          onEvent(payload);
        }
      } catch (err) {
        console.error('Failed to parse SSE payload:', err);
      }
    };

    eventSource.onerror = err => {
      // SSE reconnects automatically; this is usually a transport notice
      console.warn('SSE stream notice:', err);
      if (typeof onError === 'function') {
        onError(err);
      }
    };

    // Return cleanup function
    return () => {
      eventSource.close();
    };
  }
};

export default api;
