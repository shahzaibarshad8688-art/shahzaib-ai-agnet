export const apiCallerTool = {
  name: 'api_caller',
  label: 'REST API & Webhook Integration',
  description: 'Make genuine HTTP requests (GET, POST, PUT, DELETE) to external REST APIs or webhooks. State-modifying requests require approval checkpoint.',
  category: 'network',
  requiresConfirmation: true, // Evaluated dynamically based on HTTP method
  dangerLevel: 'medium',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The complete HTTP/HTTPS URL to query'
      },
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        description: 'HTTP method (default: GET)'
      },
      headers: {
        type: 'object',
        description: 'Optional HTTP headers as key-value pairs (e.g. {"Authorization": "Bearer ...", "Content-Type": "application/json"})'
      },
      body: {
        type: 'string',
        description: 'Optional request body (JSON string or raw payload)'
      },
      timeoutMs: {
        type: 'number',
        description: 'Request timeout in milliseconds (default: 8000)'
      }
    },
    required: ['url']
  },

  checkRequiresConfirmation(args) {
    const method = (args?.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      return {
        required: true,
        dangerLevel: method === 'DELETE' ? 'high' : 'medium',
        reason: `Agent is requesting to send an external ${method} request to:\n${args.url}`
      };
    }
    return { required: false, dangerLevel: 'safe' };
  },

  async execute({ url, method = 'GET', headers = {}, body, timeoutMs = 8000 }) {
    const startTime = Date.now();
    const upperMethod = method.toUpperCase();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.min(timeoutMs, 15000));

    try {
      const fetchOptions = {
        method: upperMethod,
        headers: {
          'User-Agent': 'ShahzaibAIAgent/1.0 (REST-Client)',
          ...headers
        },
        signal: controller.signal
      };

      if (['POST', 'PUT', 'PATCH'].includes(upperMethod) && body) {
        fetchOptions.body = typeof body === 'object' ? JSON.stringify(body) : body;
        if (!fetchOptions.headers['Content-Type'] && !fetchOptions.headers['content-type']) {
          fetchOptions.headers['Content-Type'] = 'application/json';
        }
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      const durationMs = Date.now() - startTime;
      const contentType = response.headers.get('content-type') || '';
      
      let data;
      if (contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch {
          data = await response.text();
        }
      } else {
        const text = await response.text();
        data = text.length > 5000 ? text.slice(0, 5000) + '... (truncated)' : text;
      }

      const resHeaders = {};
      for (const [key, value] of response.headers.entries()) {
        resHeaders[key] = value;
      }

      return {
        status: response.ok ? 'success' : 'http_error',
        statusCode: response.status,
        statusText: response.statusText,
        durationMs,
        headers: resHeaders,
        data
      };
    } catch (err) {
      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;
      return {
        status: 'error',
        errorName: err.name,
        errorMessage: err.message,
        durationMs
      };
    }
  }
};

export default apiCallerTool;
