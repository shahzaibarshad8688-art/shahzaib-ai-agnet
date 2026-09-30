import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../../data');
const MEMORY_FILE = path.join(DATA_DIR, 'memory.json');

const INITIAL_MEMORIES = [
  {
    id: 'mem_creator_profile',
    category: 'facts',
    key: 'Creator Identity',
    value: 'Shahzaib AI Agent was created by SHAHZAIB ARSHAD KHAGGA as a high-performance personal AI companion.',
    tags: ['creator', 'identity', 'shahzaib'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mem_primary_directive',
    category: 'instructions',
    key: 'Core System Directive',
    value: 'Always provide truthful, high-quality, actionable results. Break tasks into plans before executing tools, and confirm before destructive actions.',
    tags: ['directives', 'safety', 'planning'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mem_code_style',
    category: 'preferences',
    key: 'Coding Standards',
    value: 'Write clean, robust, modern JavaScript/Node.js and modern vanilla CSS without extraneous boilerplate. Include explanatory comments.',
    tags: ['code', 'engineering'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mem_project_main',
    category: 'projects',
    key: 'Current Project',
    value: 'Shahzaib AI Agent - A modular, multi-provider, tool-empowered autonomous agent platform.',
    tags: ['project', 'roadmap'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

class MemoryStore {
  constructor() {
    this.memories = [];
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return this.memories;
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const raw = await fs.readFile(MEMORY_FILE, 'utf-8');
      this.memories = JSON.parse(raw);
    } catch {
      this.memories = [...INITIAL_MEMORIES];
      await this.save();
    }
    this.initialized = true;
    return this.memories;
  }

  async save() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(MEMORY_FILE, JSON.stringify(this.memories, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save memory store:', err);
    }
  }

  async getAll() {
    await this.init();
    return this.memories;
  }

  async getByCategory(category) {
    await this.init();
    return this.memories.filter(m => m.category.toLowerCase() === category.toLowerCase());
  }

  async add({ category, key, value, tags = [] }) {
    await this.init();
    const newEntry = {
      id: `mem_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      category: category || 'facts',
      key: key || 'Untitled Note',
      value: value || '',
      tags: Array.isArray(tags) ? tags : String(tags).split(',').map(t => t.trim()).filter(Boolean),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.memories.unshift(newEntry);
    await this.save();
    return newEntry;
  }

  async update(id, updates) {
    await this.init();
    const idx = this.memories.findIndex(m => m.id === id);
    if (idx === -1) return null;

    this.memories[idx] = {
      ...this.memories[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    await this.save();
    return this.memories[idx];
  }

  async delete(id) {
    await this.init();
    const beforeLen = this.memories.length;
    this.memories = this.memories.filter(m => m.id !== id);
    if (this.memories.length !== beforeLen) {
      await this.save();
      return true;
    }
    return false;
  }

  async search(query) {
    await this.init();
    if (!query || typeof query !== 'string' || !query.trim()) {
      return this.memories;
    }
    const q = query.toLowerCase();
    return this.memories.filter(m =>
      m.key.toLowerCase().includes(q) ||
      m.value.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      (m.tags && m.tags.some(tag => tag.toLowerCase().includes(q)))
    );
  }

  async getFormattedContextForPrompt(userPrompt = '') {
    await this.init();
    const q = (userPrompt || '').toLowerCase();
    
    // Find memories matching prompt keywords or high-priority categories
    const relevant = this.memories.filter(m => {
      if (m.category === 'instructions' || m.category === 'preferences') return true;
      const terms = q.split(/\s+/).filter(t => t.length > 3);
      return terms.some(term => 
        m.key.toLowerCase().includes(term) || 
        m.value.toLowerCase().includes(term)
      );
    });

    if (relevant.length === 0) return '';

    return `\n### Persistent Agent Memory & User Context:\n` +
      relevant.map(m => `- [${m.category.toUpperCase()} / ${m.key}]: ${m.value}`).join('\n');
  }
}

export const memoryStore = new MemoryStore();
export default memoryStore;
