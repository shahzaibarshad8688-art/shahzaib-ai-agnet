/**
 * Central State Store for Shahzaib AI Agent
 */

class StateStore {
  constructor() {
    this.state = {
      activeSessionId: null,
      sessionsList: [],
      activeSession: null,
      activeTab: 'chat',
      inspectorTab: 'tasks',
      inspectorOpen: true,
      activePlan: null,
      activityLogs: [],
      settings: null,
      providers: [],
      tools: [],
      memories: [],
      isAgentRunning: false,
      agentStatusText: 'Online • Idle',
      agentStatusMode: 'idle', // 'idle' | 'planning' | 'running' | 'awaiting'
      activeCheckpoint: null
    };

    this.listeners = new Map();
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    const oldValue = this.state[key];
    this.state[key] = value;
    this.notify(key, value, oldValue);
  }

  update(partial) {
    for (const [key, val] of Object.entries(partial)) {
      this.set(key, val);
    }
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);

    return () => {
      this.listeners.get(key)?.delete(callback);
    };
  }

  notify(key, newValue, oldValue) {
    const set = this.listeners.get(key);
    if (set) {
      for (const cb of set) {
        try {
          cb(newValue, oldValue);
        } catch (err) {
          console.error(`Error in state listener for key "${key}":`, err);
        }
      }
    }
  }

  addLog(msg, level = 'info') {
    const logItem = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      time: new Date().toLocaleTimeString(),
      message: msg,
      level // 'info' | 'success' | 'warning' | 'error'
    };
    const next = [logItem, ...this.state.activityLogs].slice(0, 150);
    this.set('activityLogs', next);
  }
}

export const state = new StateStore();
export default state;
