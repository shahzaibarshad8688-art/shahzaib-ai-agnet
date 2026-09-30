/**
 * Shahzaib AI Agent — Backend Server
 * Creator: SHAHZAIB ARSHAD KHAGGA
 *
 * NOTE: dotenv must be loaded before any module that reads process.env.
 * In ES modules, all `import` statements are hoisted, so we use
 * the `dotenv/config` side-effect import which runs during module
 * evaluation and is resolved in order for static imports.
 *
 * We set DOTENV_CONFIG_PATH before importing so dotenv picks up the correct file.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

// Set the env path before the side-effect import resolves
process.env.DOTENV_CONFIG_PATH = path.join(ROOT_DIR, '.env');

import 'dotenv/config';

// ── Now safe to import modules that rely on process.env ──────────────────────
import express from 'express';
import cors from 'cors';
import { settingsManager } from './config/settings.js';
import { memoryStore } from './memory/memory_store.js';
import { historyStore } from './memory/history_store.js';
import { toolRegistry } from './tools/registry.js';
import { agentExecutor } from './agent/executor.js';
import { getAllProviderInfo, getProvider } from './providers/index.js';

const FRONTEND_DIR = path.resolve(ROOT_DIR, 'frontend');
const WORKSPACE_DIR = path.resolve(ROOT_DIR, 'data/workspace');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Serve frontend static files at root ──────────────────────────────────────
app.use(express.static(FRONTEND_DIR));
app.use('/workspace-files', express.static(WORKSPACE_DIR));

// Initialize data stores on boot
async function initSystems() {
  await settingsManager.init();
  await memoryStore.init();
  await historyStore.init();
}

// ──────────────────────────────────────────────────────────────────────────────
// SYSTEM & HEALTH
// ──────────────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const settings = settingsManager.get();
  res.json({
    status: 'online',
    appName: settings.appName,
    creator: settings.creator,
    activeProvider: settings.provider,
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    port: PORT
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// SETTINGS
// ──────────────────────────────────────────────────────────────────────────────
app.get('/api/settings', async (req, res) => {
  await settingsManager.init();
  res.json(settingsManager.getSanitized());
});

app.post('/api/settings', async (req, res) => {
  try {
    await settingsManager.update(req.body);
    res.json({ success: true, settings: settingsManager.getSanitized() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// AI PROVIDERS
// ──────────────────────────────────────────────────────────────────────────────
app.get('/api/providers', (req, res) => {
  res.json(getAllProviderInfo());
});

app.post('/api/providers/test', async (req, res) => {
  const { providerName } = req.body;
  try {
    const provider = getProvider(providerName);
    const result = await provider.validateCredentials();
    res.json(result);
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// CONVERSATIONS & SESSIONS
// ──────────────────────────────────────────────────────────────────────────────
app.get('/api/sessions', async (req, res) => {
  const list = await historyStore.listSessions();
  res.json(list);
});

app.post('/api/sessions', async (req, res) => {
  const session = await historyStore.createSession(req.body?.title || 'New Session');
  res.status(201).json(session);
});

app.get('/api/sessions/:id', async (req, res) => {
  const session = await historyStore.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found.' });
  res.json(session);
});

app.delete('/api/sessions/:id', async (req, res) => {
  const ok = await historyStore.deleteSession(req.params.id);
  res.json({ success: ok });
});

// ──────────────────────────────────────────────────────────────────────────────
// AGENT EXECUTION & REAL-TIME STREAMING (SSE)
// ──────────────────────────────────────────────────────────────────────────────

// SSE stream — delivers real-time agent events to the frontend
app.get('/api/agent/stream/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Confirm connection
  res.write(`data: ${JSON.stringify({ type: 'stream_connected', sessionId })}\n\n`);

  const unsubscribe = agentExecutor.subscribe(sessionId, payload => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  });

  // Keepalive heartbeat
  const heartbeat = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// Trigger agent task
app.post('/api/agent/run', async (req, res) => {
  const { sessionId, prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  const activeSessionId = sessionId || 'session_default';

  try {
    if (req.query.async === 'true') {
      // Non-blocking — client monitors via SSE stream
      agentExecutor.execute({ sessionId: activeSessionId, userPrompt: prompt })
        .catch(err => console.error('[Agent async error]', err.message));
      res.json({ status: 'initiated', sessionId: activeSessionId });
    } else {
      // Blocking — wait for full result
      const result = await agentExecutor.execute({ sessionId: activeSessionId, userPrompt: prompt });
      res.json({ status: 'success', sessionId: activeSessionId, ...result });
    }
  } catch (err) {
    console.error('[Agent run error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Human checkpoint resolution
app.post('/api/agent/confirm', (req, res) => {
  const { checkpointId, approved, autoApproveSession, notes } = req.body;
  if (!checkpointId) {
    return res.status(400).json({ error: 'checkpointId is required.' });
  }
  try {
    const outcome = agentExecutor.resolveCheckpoint(checkpointId, {
      approved: Boolean(approved),
      autoApproveSession: Boolean(autoApproveSession),
      notes
    });
    res.json(outcome);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List pending checkpoints
app.get('/api/agent/checkpoints', (req, res) => {
  res.json(agentExecutor.getPendingCheckpoints());
});

// ──────────────────────────────────────────────────────────────────────────────
// TOOLS MANAGEMENT & DIRECT EXECUTION
// ──────────────────────────────────────────────────────────────────────────────
app.get('/api/tools', (req, res) => {
  res.json(toolRegistry.getAllTools());
});

app.post('/api/tools/:name/toggle', (req, res) => {
  const { enabled } = req.body;
  try {
    const updated = toolRegistry.toggleTool(req.params.name, enabled);
    res.json({ success: true, tool: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Direct tool test (Tools Hub UI)
app.post('/api/tools/:name/test', async (req, res) => {
  const toolName = req.params.name;
  const args = req.body.args || {};
  try {
    const result = await toolRegistry.executeTool(toolName, args, { context: 'manual_test' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message, tool: toolName });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// MEMORY STORE
// ──────────────────────────────────────────────────────────────────────────────
app.get('/api/memory', async (req, res) => {
  const { q, category } = req.query;
  if (q) return res.json(await memoryStore.search(q));
  if (category) return res.json(await memoryStore.getByCategory(category));
  res.json(await memoryStore.getAll());
});

app.post('/api/memory', async (req, res) => {
  const { category, key, value, tags } = req.body;
  if (!key || !value) {
    return res.status(400).json({ error: 'Fields "key" and "value" are required.' });
  }
  const entry = await memoryStore.add({ category, key, value, tags });
  res.status(201).json(entry);
});

app.put('/api/memory/:id', async (req, res) => {
  const updated = await memoryStore.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Memory entry not found.' });
  res.json(updated);
});

app.delete('/api/memory/:id', async (req, res) => {
  const ok = await memoryStore.delete(req.params.id);
  res.json({ success: ok });
});

// ──────────────────────────────────────────────────────────────────────────────
// WORKSPACE QUICK ACCESS
// ──────────────────────────────────────────────────────────────────────────────
app.get('/api/workspace', async (req, res) => {
  try {
    const result = await toolRegistry.executeTool('file_manager', { action: 'list' }, { context: 'api' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// ERROR HANDLERS
// ──────────────────────────────────────────────────────────────────────────────
// Unknown API routes → clear JSON error
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: `No API route: ${req.method} ${req.path}` });
  }
  next();
});

// SPA fallback for all non-API routes → serve index.html
app.use((req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// ── Start server ──────────────────────────────────────────────────────────────
initSystems().then(() => {
  app.listen(PORT, () => {
    const providerName = settingsManager.get().provider;
    console.log(`\n======================================================`);
    console.log(`  SHAHZAIB AI AGENT — AUTONOMOUS WORKSPACE`);
    console.log(`  Creator : SHAHZAIB ARSHAD KHAGGA`);
    console.log(`  URL     : http://localhost:${PORT}`);
    console.log(`  Provider: ${providerName}`);
    console.log(`======================================================\n`);
  });
}).catch(err => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
