import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../../data');
const SESSIONS_FILE = path.join(DATA_DIR, 'conversations.json');

class HistoryStore {
  constructor() {
    this.sessions = [];
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return this.sessions;
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const raw = await fs.readFile(SESSIONS_FILE, 'utf-8');
      this.sessions = JSON.parse(raw);
    } catch {
      // Create initial default session
      const defaultSession = {
        id: 'session_default',
        title: 'Welcome to Shahzaib AI Agent',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: 'msg_init',
            role: 'agent',
            content: `Greetings! I am **Shahzaib AI Agent**, your high-performance autonomous personal intelligence workstation.

I am built exclusively for **SHAHZAIB ARSHAD KHAGGA** with full agentic capabilities:
- 🎯 **Goal Decomposition & Planning**: Breaking complex queries into structured execution steps.
- 🛡️ **Safety Checkpoints**: Requesting your authorization before executing destructive actions or external calls.
- 🧠 **Persistent Memory**: Storing your preferences, projects, and directives across all sessions.
- ⚡ **Extensible Real Tools**: Live web research, file read/write, sandboxed code execution, document generation, and API integrations.

How may I assist you today?`,
            plan: null,
            toolsUsed: [],
            timestamp: new Date().toISOString()
          }
        ],
        activeTasks: []
      };
      this.sessions = [defaultSession];
      await this.save();
    }
    this.initialized = true;
    return this.sessions;
  }

  async save() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(SESSIONS_FILE, JSON.stringify(this.sessions, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save sessions:', err);
    }
  }

  async listSessions() {
    await this.init();
    return this.sessions.map(s => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      messageCount: s.messages ? s.messages.length : 0
    }));
  }

  async getSession(id) {
    await this.init();
    let session = this.sessions.find(s => s.id === id);
    if (!session) {
      // If not found, return or create default
      if (this.sessions.length > 0) return this.sessions[0];
      session = await this.createSession('New Session');
    }
    return session;
  }

  async createSession(title = 'New Session') {
    await this.init();
    const newSession = {
      id: `session_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      title: title || 'New Session',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      activeTasks: []
    };
    this.sessions.unshift(newSession);
    await this.save();
    return newSession;
  }

  async addMessage(sessionId, message) {
    await this.init();
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const msgWithMeta = {
      id: `msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      timestamp: new Date().toISOString(),
      ...message
    };

    session.messages.push(msgWithMeta);
    session.updatedAt = new Date().toISOString();

    // Auto-update title if it was a new session and first user message
    if (session.messages.filter(m => m.role === 'user').length === 1 && message.role === 'user') {
      session.title = message.content.slice(0, 38).trim() || 'New Session';
    }

    await this.save();
    return msgWithMeta;
  }

  async updateMessage(sessionId, messageId, updates) {
    await this.init();
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return null;
    const msg = session.messages.find(m => m.id === messageId);
    if (!msg) return null;

    Object.assign(msg, updates);
    session.updatedAt = new Date().toISOString();
    await this.save();
    return msg;
  }

  async updateSessionTasks(sessionId, tasks) {
    await this.init();
    const session = this.sessions.find(s => s.id === sessionId);
    if (session) {
      session.activeTasks = tasks;
      session.updatedAt = new Date().toISOString();
      await this.save();
    }
  }

  async deleteSession(sessionId) {
    await this.init();
    const initialLen = this.sessions.length;
    this.sessions = this.sessions.filter(s => s.id !== sessionId);
    if (this.sessions.length === 0) {
      // Always keep at least one session
      await this.createSession('New Session');
    } else if (this.sessions.length !== initialLen) {
      await this.save();
    }
    return true;
  }
}

export const historyStore = new HistoryStore();
export default historyStore;
