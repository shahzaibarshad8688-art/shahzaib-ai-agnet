import { BaseAIProvider } from './base.js';

/**
 * Autonomous Built-in Engine for Shahzaib AI Agent
 * A transparent, deterministic ReAct agent engine that allows complete agentic operation,
 * task decomposition, real tool execution, and confirmation checkpoints out of the box,
 * even before external cloud LLM API keys are provided.
 */
export class DeterministicProvider extends BaseAIProvider {
  constructor(config = {}) {
    super('deterministic', config);
  }

  getAvailableModels() {
    return [
      { id: 'deterministic-react', name: 'Autonomous Built-in ReAct Engine (Zero Setup / Offline Ready)' }
    ];
  }

  async validateCredentials() {
    return { ok: true, message: 'Autonomous Built-in Engine is active and operational.' };
  }

  /**
   * Intent and Task Decomposition Planner
   */
  async generatePlan({ request, context = '', availableTools = [] }) {
    const text = request.trim();
    const lower = text.toLowerCase();
    const plan = [];
    let reasoning = '';

    // 1. Web research & searching
    if (
      lower.startsWith('search') ||
      lower.startsWith('find out') ||
      lower.includes('search the web') ||
      lower.includes('research') ||
      lower.includes('look up') ||
      lower.includes('what is the latest') ||
      lower.includes('who is') ||
      lower.includes('news about')
    ) {
      let query = text
        .replace(/^(please\s+)?(search\s+(the\s+web\s+for|for)?|research|look\s+up|find\s+out\s+about)\s+/i, '')
        .replace(/[?.!]+$/, '')
        .trim();
      if (!query) query = text;

      reasoning = `Identified request as information retrieval requiring real-time web intelligence. Decomposing into live web search query and factual synthesis.`;
      
      plan.push({
        id: 'step-1',
        title: `Search live web for: "${query}"`,
        tool: 'web_search',
        args: { query, maxResults: 4 },
        requiresConfirmation: false
      });

      if (lower.includes('save') || lower.includes('document') || lower.includes('report') || lower.includes('file')) {
        plan.push({
          id: 'step-2',
          title: `Generate research summary document`,
          tool: 'doc_generator',
          args: {
            title: `Research on ${query.slice(0, 30)}`,
            content: `Document generated from findings on "${query}".`,
            format: 'markdown'
          },
          requiresConfirmation: false
        });
      }
    }
    // 2. Code execution / calculations
    else if (
      lower.startsWith('run code') ||
      lower.startsWith('execute') ||
      lower.includes('calculate') ||
      lower.includes('compute') ||
      lower.includes('eval') ||
      lower.includes('javascript') ||
      lower.includes('run js')
    ) {
      reasoning = `Identified code execution or computational task. Scheduling isolated JS sandbox evaluation.`;

      let code = text;
      const codeMatch = text.match(/```(?:js|javascript)?\s*([\s\S]*?)```/i);
      if (codeMatch) {
        code = codeMatch[1].trim();
      } else {
        code = text.replace(/^(run code|execute|run js|calculate|compute)\s*:?/i, '').trim();
      }

      plan.push({
        id: 'step-1',
        title: 'Execute script in isolated sandbox',
        tool: 'code_runner',
        args: { code },
        requiresConfirmation: true
      });
    }
    // 3. File Operations (read, write, list, delete)
    else if (
      lower.startsWith('create file') ||
      lower.startsWith('write file') ||
      lower.startsWith('save to file') ||
      lower.includes('read file') ||
      lower.includes('list files') ||
      lower.includes('delete file') ||
      lower.includes('workspace files')
    ) {
      if (lower.includes('list') || lower.includes('show files') || lower.includes('workspace files')) {
        reasoning = `Request involves workspace inspection. Scheduling file system scan.`;
        plan.push({
          id: 'step-1',
          title: 'List files in agent workspace',
          tool: 'file_manager',
          args: { action: 'list' },
          requiresConfirmation: false
        });
      } else if (lower.includes('read')) {
        const fileMatch = text.match(/read\s+(?:file\s+)?([a-zA-Z0-9_\-\.\/\\]+)/i);
        const filepath = fileMatch ? fileMatch[1] : 'notes.txt';
        reasoning = `Inspecting specified workspace file: ${filepath}`;
        plan.push({
          id: 'step-1',
          title: `Read workspace file: ${filepath}`,
          tool: 'file_manager',
          args: { action: 'read', filepath },
          requiresConfirmation: false
        });
      } else if (lower.includes('delete')) {
        const fileMatch = text.match(/delete\s+(?:file\s+)?([a-zA-Z0-9_\-\.\/\\]+)/i);
        const filepath = fileMatch ? fileMatch[1] : '';
        reasoning = `File deletion requested. Marked as high-security checkpoint requiring authorization.`;
        plan.push({
          id: 'step-1',
          title: `Delete file: ${filepath || 'target file'}`,
          tool: 'file_manager',
          args: { action: 'delete', filepath },
          requiresConfirmation: true
        });
      } else {
        // Write file
        const fileMatch = text.match(/(?:create|write)\s+(?:file\s+)?([a-zA-Z0-9_\-\.\/\\]+)/i);
        const filepath = fileMatch ? fileMatch[1] : `note_${Date.now()}.txt`;
        const contentMatch = text.match(/content:\s*([\s\S]*)$/i) || text.match(/with\s+text:\s*([\s\S]*)$/i);
        const content = contentMatch ? contentMatch[1].trim() : `Generated by Shahzaib AI Agent\nCreated for SHAHZAIB ARSHAD KHAGGA\nTimestamp: ${new Date().toISOString()}`;

        reasoning = `File creation requested. System pauses at confirmation checkpoint before writing to disk.`;
        plan.push({
          id: 'step-1',
          title: `Write file: ${filepath}`,
          tool: 'file_manager',
          args: { action: 'write', filepath, content },
          requiresConfirmation: true
        });
      }
    }
    // 4. Document / Report Generation
    else if (
      lower.startsWith('generate document') ||
      lower.startsWith('create document') ||
      lower.startsWith('generate report') ||
      lower.includes('create a report') ||
      lower.includes('make a report')
    ) {
      const topic = text.replace(/^(generate document|create document|generate report|create a report|make a report)\s*(on|about|for)?\s*/i, '').trim() || 'Agent Strategy Brief';
      reasoning = `Synthesizing and persisting structured documentation.`;

      plan.push({
        id: 'step-1',
        title: `Generate structured document on: ${topic}`,
        tool: 'doc_generator',
        args: {
          title: topic,
          format: 'markdown',
          content: `## Strategy & Overview\n\nThis brief on **${topic}** was initiated by **SHAHZAIB ARSHAD KHAGGA**.\n\n### Objectives\n- Systematize high-impact agentic operations.\n- Accelerate autonomous intelligence workflows.\n\n### Implementation Plan\n1. Establish clear boundary definitions.\n2. Leverage specialized tools with checkpoint verification.\n3. Record actionable insights to persistent memory.`
        },
        requiresConfirmation: false
      });
    }
    // 5. REST API Call
    else if (
      lower.includes('api call') ||
      lower.includes('fetch api') ||
      lower.includes('http get') ||
      lower.includes('http post') ||
      lower.startsWith('curl ') ||
      lower.startsWith('fetch http')
    ) {
      const urlMatch = text.match(/https?:\/\/[^\s]+/i);
      const url = urlMatch ? urlMatch[0] : 'https://api.github.com/zen';
      const method = lower.includes('post') ? 'POST' : 'GET';
      reasoning = `Making real HTTP request to remote API endpoint.`;

      plan.push({
        id: 'step-1',
        title: `HTTP ${method} -> ${url.slice(0, 35)}...`,
        tool: 'api_caller',
        args: { url, method },
        requiresConfirmation: method === 'POST'
      });
    }
    // 6. Workflow Runner
    else if (
      lower.includes('audit workspace') ||
      lower.includes('system audit') ||
      lower.includes('run workflow')
    ) {
      reasoning = `Triggering multi-step autonomous workflow.`;
      plan.push({
        id: 'step-1',
        title: 'Run workspace audit automation',
        tool: 'workflow_runner',
        args: { workflowType: 'workspace_audit' },
        requiresConfirmation: false
      });
    }
    // 7. General inquiry / strategic conversation
    else {
      reasoning = `General conversation or strategic consultation. No external tool execution required; synthesizing direct response.`;
      plan.push({
        id: 'step-1',
        title: `Formulate response for: "${text.slice(0, 40)}"`,
        tool: null,
        args: {},
        requiresConfirmation: false
      });
    }

    return { plan, reasoning };
  }

  /**
   * Conversational synthesis and tool response interpretation
   */
  async generateResponse({ messages, systemPrompt, tools = [], temperature = 0.7 }) {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const query = lastUserMsg?.content || '';
    const lower = query.toLowerCase();

    // Contextual answer builder
    let text = '';

    if (lower.includes('who are you') || lower.includes('what is your name')) {
      text = `I am **Shahzaib AI Agent**, a professional, highly autonomous personal AI workstation built exclusively for **SHAHZAIB ARSHAD KHAGGA**.\n\nI combine multi-provider AI reasoning, dynamic task planning, confirmation checkpoints for safe execution, persistent long-term memory, and an extensible suite of real tools (Live Web Search, File System, Code Sandbox, Report Generator, and API Caller).`;
    } else if (lower.includes('who created you') || lower.includes('creator')) {
      text = `I was engineered specifically for and by **SHAHZAIB ARSHAD KHAGGA** as an autonomous, high-caliber personal AI system.`;
    } else if (lower.includes('what tools') || lower.includes('available tools') || lower.includes('capabilities')) {
      text = `I have access to genuine, fully connected tools:\n\n` +
        `1. 🌐 **Live Web Research (\`web_search\`)**: Real DuckDuckGo and Wikipedia queries with page text extraction.\n` +
        `2. 📁 **Workspace File System (\`file_manager\`)**: Read, write, list, and delete files inside the agent's safe workspace.\n` +
        `3. 💻 **Code Sandbox (\`code_runner\`)**: Isolated JavaScript VM execution with output logging and runtime controls.\n` +
        `4. 📝 **Document Generator (\`doc_generator\`)**: Generates structured Markdown and HTML reports.\n` +
        `5. 🔌 **REST API & Webhooks (\`api_caller\`)**: Makes real HTTP calls to remote servers.\n` +
        `6. ⚡ **Workflow Runner (\`workflow_runner\`)**: Multi-step automated sequences (e.g. Research & Document).\n\n` +
        `All potentially destructive or state-modifying actions pause for your **Confirmation Checkpoint** approval!`;
    } else if (lower.includes('help') || lower.includes('commands') || lower.includes('how to use')) {
      text = `### Quick Start Guide for Shahzaib AI Agent:\n\n` +
        `- **Web Research**: Type *"Search the web for latest quantum computing breakthroughs"* or *"Research Node.js v24 features"*.\n` +
        `- **Code Execution**: Type *"Run code: const x = [1,2,3,4]; console.log(x.reduce((a,b) => a+b, 0));"*.\n` +
        `- **File Creation**: Type *"Create file project_notes.md content: Project initiated by Shahzaib Arshad Khagga"*.\n` +
        `- **Workspace Audit**: Type *"Audit workspace"* or *"List files"*.\n` +
        `- **Document Generation**: Type *"Generate report on Agentic AI Architectures"*.\n` +
        `- **Settings**: Click the **Settings** tab in the sidebar to configure Gemini, OpenAI, Claude, or Ollama API keys.`;
    } else {
      text = `Understood. I have evaluated your request: **"${query}"**.\n\n` +
        `As **Shahzaib AI Agent**, I am ready to plan, analyze, and execute this across my tools and persistent memory store.\n\n` +
        `To trigger specific tool chains, you can ask me to search the web, execute code in the sandbox, inspect or create files in the workspace, or generate documentation. You can also configure cloud LLM providers (Gemini, OpenAI, Claude, Ollama) anytime in the **Settings** panel.`;
    }

    return {
      text,
      toolCalls: []
    };
  }
}

export default DeterministicProvider;
