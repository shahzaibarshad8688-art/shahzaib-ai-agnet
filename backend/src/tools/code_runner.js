import vm from 'node:vm';

export const codeRunnerTool = {
  name: 'code_runner',
  label: 'Code Sandbox & Execution',
  description: 'Safely execute JavaScript code in an isolated sandbox with timeout and console capture. Evaluates algorithms, data transformations, and math calculations.',
  category: 'execution',
  requiresConfirmation: true,
  dangerLevel: 'high',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'JavaScript code snippet to execute'
      },
      timeoutMs: {
        type: 'number',
        description: 'Maximum runtime in milliseconds before aborting (default 5000)'
      }
    },
    required: ['code']
  },

  checkRequiresConfirmation(args) {
    return {
      required: true,
      dangerLevel: 'high',
      reason: `Agent is requesting authorization to execute JavaScript code in the sandbox environment:\n\n${(args?.code || '').slice(0, 150)}...`
    };
  },

  async execute({ code, timeoutMs = 5000 }) {
    const logs = [];
    const startTime = Date.now();

    const customConsole = {
      log: (...args) => logs.push(args.map(a => formatArg(a)).join(' ')),
      error: (...args) => logs.push('[ERROR] ' + args.map(a => formatArg(a)).join(' ')),
      warn: (...args) => logs.push('[WARN] ' + args.map(a => formatArg(a)).join(' ')),
      info: (...args) => logs.push('[INFO] ' + args.map(a => formatArg(a)).join(' '))
    };

    // Safe sandbox context
    const sandbox = {
      console: customConsole,
      Math,
      Date,
      JSON,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Map,
      Set,
      Promise,
      setTimeout: (fn, ms) => {
        if (ms > 1000) ms = 1000;
        return setTimeout(fn, ms);
      },
      Buffer: {
        from: (...a) => Buffer.from(...a),
        byteLength: (...a) => Buffer.byteLength(...a)
      }
    };

    const vmContext = vm.createContext(sandbox);

    try {
      // Wrap code in async IIFE if it uses await or top-level return
      const scriptCode = `
        (async () => {
          ${code}
        })()
      `;

      const script = new vm.Script(scriptCode, {
        filename: 'shahzaib_sandbox.js'
      });

      const promise = script.runInContext(vmContext, {
        timeout: Math.min(timeoutMs, 10000),
        breakOnSigint: true
      });

      const result = await promise;
      const duration = Date.now() - startTime;

      return {
        status: 'success',
        durationMs: duration,
        returnValue: result !== undefined ? formatArg(result) : null,
        consoleLogs: logs,
        outputSummary: logs.length > 0 ? logs.join('\n') : (result !== undefined ? String(result) : 'Execution completed with no return value.')
      };
    } catch (err) {
      const duration = Date.now() - startTime;
      return {
        status: 'error',
        durationMs: duration,
        errorName: err.name,
        errorMessage: err.message,
        consoleLogs: logs,
        stack: err.stack ? err.stack.split('\n').slice(0, 3).join('\n') : null
      };
    }
  }
};

function formatArg(arg) {
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';
  if (typeof arg === 'object') {
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

export default codeRunnerTool;
