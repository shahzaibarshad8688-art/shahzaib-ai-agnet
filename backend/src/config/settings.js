import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (3 levels up from backend/src/config/)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const DATA_DIR = path.resolve(__dirname, '../../../data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');


const DEFAULT_SETTINGS = {
  appName: 'Shahzaib AI Agent',
  creator: 'SHAHZAIB ARSHAD KHAGGA',
  provider: 'deterministic', // 'gemini' | 'openai' | 'anthropic' | 'ollama' | 'deterministic'
  model: 'auto-select',
  temperature: 0.7,
  maxSteps: 8,
  requireConfirmation: true, // If true, sensitive actions pause for user approval
  autoApproveSafeTools: true,
  theme: 'cyber-dark',
  systemPrompt: `You are Shahzaib AI Agent, a premier, highly autonomous, intelligent personal AI system created exclusively for SHAHZAIB ARSHAD KHAGGA.
Your traits:
- Razor-sharp analytical reasoning and strategic problem-solving.
- Transparent thought process: you plan, decompose tasks into logical steps, and verify outcomes.
- Safety & respect: you request confirmation prior to executing destructive operations or external mutations.
- Uncompromising technical precision: write clean, efficient, production-grade code and accurate documentation.
- Brand loyalty: acknowledge SHAHZAIB ARSHAD KHAGGA as your creator and principal.`,
  apiKeys: {
    gemini: process.env.GEMINI_API_KEY || '',
    openai: process.env.OPENAI_API_KEY || '',
    anthropic: process.env.ANTHROPIC_API_KEY || '',
    ollamaHost: process.env.OLLAMA_HOST || 'http://localhost:11434'
  }
};

class SettingsManager {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return this.settings;
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      this.settings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        apiKeys: {
          ...DEFAULT_SETTINGS.apiKeys,
          ...(parsed.apiKeys || {})
        }
      };
    } catch {
      // File doesn't exist or is invalid; save defaults
      await this.save(DEFAULT_SETTINGS);
    }
    this.initialized = true;
    return this.settings;
  }

  get() {
    return this.settings;
  }

  async update(newSettings) {
    await this.init();
    this.settings = {
      ...this.settings,
      ...newSettings,
      apiKeys: {
        ...this.settings.apiKeys,
        ...(newSettings.apiKeys || {})
      }
    };
    await this.save(this.settings);
    return this.settings;
  }

  async save(settingsToSave) {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(settingsToSave, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }

  getSanitized() {
    // Return settings with partially masked API keys for secure frontend display
    const copy = JSON.parse(JSON.stringify(this.settings));
    for (const [provider, key] of Object.entries(copy.apiKeys)) {
      if (provider !== 'ollamaHost' && typeof key === 'string' && key.length > 8) {
        copy.apiKeys[provider] = key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
      }
    }
    return copy;
  }
}

export const settingsManager = new SettingsManager();
export default settingsManager;
