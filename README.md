# Shahzaib AI Agent ⚡

> **Personal Autonomous Intelligence Workstation**  
> **Creator & Principal**: SHAHZAIB ARSHAD KHAGGA  
> **Architecture**: Modular Agentic Full-Stack (Node.js ESM + Vanilla Cyber-Dark UI + Pluggable LLM Providers)

---

## 🌟 Overview

**Shahzaib AI Agent** is not a simple chatbot. It is a full-featured, production-ready personal AI agent with a high-tech dashboard, goal decomposition engine, connected real-world tools, interactive safety checkpoints, persistent long-term memory, and multi-provider AI support.

---

## 🚀 Key Features

### 1. 🎯 Dynamic Task Planning System
- Automatically evaluates high-level user directives and decomposes them into structured, sequential execution steps before running tools.
- Visual real-time plan tree with step states: `pending` ➔ `running` ➔ `awaiting authorization` ➔ `completed` / `failed`.
- Calculates plan progress in real-time.

### 2. 🛡️ Confirmation Checkpoints (Human-in-the-Loop)
- Automatically detects sensitive, state-altering, or external operations:
  - Creating, modifying, or deleting workspace files (`file_manager`).
  - Executing arbitrary code in the sandbox (`code_runner`).
  - Making remote HTTP `POST`/`PUT`/`DELETE` calls (`api_caller`).
- Pauses the execution pipeline and raises a high-visibility modal requiring authorization.
- Allows user approval, rejection, or session-wide whitelisting.

### 3. 🛠️ Genuine, Connected Tools Suite
All tools are genuinely connected with no fake mocks:
- 🌐 **Live Web Research (`web_search`)**: Queries DuckDuckGo & Wikipedia APIs with real webpage text extraction.
- 📁 **Workspace File System (`file_manager`)**: Sandboxed file read, write, list, search, and delete inside `data/workspace/`.
- 💻 **Code Sandbox (`code_runner`)**: Real JavaScript VM execution (`node:vm`) with runtime limits and captured console output.
- 📝 **Document Generator (`doc_generator`)**: Generates structured Markdown and HTML executive reports.
- 🔌 **REST API Integration (`api_caller`)**: Sends genuine HTTP requests to remote APIs and webhooks.
- ⚡ **Autonomous Workflow Engine (`workflow_runner`)**: Chained multi-tool automations (e.g. Research-to-Document).

### 4. 🧠 Persistent Memory Architecture
- Stores long-term knowledge in `data/memory.json`:
  - **Preferences**: User habits and coding standards.
  - **Projects**: Active initiatives and repository briefs.
  - **Instructions**: Immutable system directives.
  - **Facts**: Specific knowledge and creator details.
- Features search, tag filtering, and dynamic injection into agent reasoning context.

### 5. 🔌 Pluggable AI Provider Architecture
Seamlessly switch providers in the Settings dashboard:
- **Autonomous Built-in Engine**: Offline-ready ReAct engine that works 100% out of the box with zero external API keys!
- **Google Gemini**: Gemini 2.0 Flash & Gemini 1.5 Pro with native tool calling.
- **OpenAI**: GPT-4o, GPT-4o Mini, and o3-mini.
- **Anthropic Claude**: Claude 3.5 Sonnet & Claude 3.5 Haiku.
- **Local Ollama**: Run fully private local models (Llama 3, Mistral, DeepSeek).

### 6. 🎨 High-Tech Cyber-Dark Glassmorphic UI
- Futuristic aesthetic with neon cyan and electric violet accents.
- Responsive 3-pane workstation with collapsible navigation sidebar and live inspector drawer.
- Server-Sent Events (SSE) for streaming thoughts, tool logs, and status updates.

---

## 📁 System Architecture

```
Shahzaib AI Agent/
├── backend/
│   └── src/
│       ├── config/
│       │   └── settings.js         # Configuration manager & API keys
│       ├── memory/
│       │   ├── memory_store.js     # Long-term knowledge base
│       │   └── history_store.js    # Multi-turn conversation sessions
│       ├── tools/
│       │   ├── registry.js         # Central tool registry & schemas
│       │   ├── web_search.js       # Live search & web fetcher
│       │   ├── file_manager.js     # Sandboxed workspace filesystem
│       │   ├── code_runner.js      # Isolated JS VM execution
│       │   ├── doc_generator.js    # Markdown & HTML report generator
│       │   ├── api_caller.js       # REST client & webhooks
│       │   └── workflow_runner.js  # Automated multi-step workflows
│       ├── providers/
│       │   ├── base.js             # Base provider interface
│       │   ├── gemini.js           # Google Gemini
│       │   ├── openai.js           # OpenAI GPT-4o
│       │   ├── anthropic.js        # Anthropic Claude
│       │   ├── ollama.js           # Local Ollama
│       │   ├── deterministic.js    # Autonomous zero-setup ReAct engine
│       │   └── index.js            # Provider factory
│       ├── agent/
│       │   ├── context.js          # Memory & persona context builder
│       │   ├── planner.js          # Task decomposition engine
│       │   └── executor.js         # Step runner, checkpoints, & synthesis
│       └── server.js               # Express REST & SSE server
├── frontend/
│   ├── index.html                  # Responsive dashboard UI
│   ├── css/
│   │   ├── variables.css           # Cyber-dark design tokens & typography
│   │   ├── layout.css              # 3-column responsive layout
│   │   ├── components.css          # Chat bubbles, cards, modals, docks
│   │   └── animations.css          # Glows, beacons, pulses
│   └── js/
│       ├── api.js                  # Client REST & SSE service
│       ├── state.js                # Reactive state store
│       ├── ui/
│       │   ├── chat.js             # Markdown chat & thought stream
│       │   ├── tasks.js            # Plan tree & progress tracker
│       │   ├── activity.js         # Live activity logs
│       │   ├── memory.js           # Memory store manager
│       │   ├── tools.js            # Tools catalog & test runner
│       │   ├── settings.js         # Provider & safety settings
│       │   └── checkpoint.js       # Human authorization modal
│       └── app.js                  # Application bootstrapper
├── data/
│   └── workspace/                  # Agent sandboxed file storage
├── start.bat                       # One-click Windows launch script
└── package.json
```

---

## ⚡ Quick Start

### 1. Launch with One Click (Windows)
Double-click `start.bat`. It will boot the agent server and open `http://localhost:3800` in your browser.

### 2. Manual Launch via Terminal
```powershell
npm start
```
Open **http://localhost:3800** in your browser.

---

## 🛡️ Brand Attribution
- **Application**: Shahzaib AI Agent
- **Principal & Creator**: SHAHZAIB ARSHAD KHAGGA
- **License**: MIT
