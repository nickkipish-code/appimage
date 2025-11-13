import fs from 'fs';
import path from 'path';
import http from 'http';
import process from 'process';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const JSONRPC_VERSION = '2.0';
const DEFAULT_WS_PORT = parseInt(process.env.MCP_PORT || process.env.PORT || '4123', 10);
const DEFAULT_TIMEOUT_MS = parseInt(process.env.N8N_MCP_TIMEOUT_MS || '25000', 10);
const BODY_PREVIEW_LIMIT = parseInt(process.env.N8N_MCP_BODY_PREVIEW_LIMIT || '8192', 10);
const API_KEY_HEADER = process.env.N8N_API_KEY_HEADER || 'X-N8N-API-KEY';
const TRANSPORT = detectTransport();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverInfo = {
  name: 'n8n-mcp-bridge',
  version: '0.1.0'
};

const n8nBaseUrl = sanitizeBaseUrl(process.env.N8N_BASE_URL);
const n8nApiKey = (process.env.N8N_API_KEY || '').trim() || null;

const workflows = loadWorkflows();
const workflowMap = new Map(workflows.map((wf) => [wf.id, wf]));

if (workflows.length === 0) {
  console.warn('[mcp:n8n] No workflows configured. Provide N8N_MCP_WORKFLOWS, N8N_MCP_WORKFLOWS_FILE, or mcp/workflows.json.');
}

if (!n8nBaseUrl) {
  console.warn('[mcp:n8n] N8N_BASE_URL is not set. Tool calls that contact n8n will fail until it is configured.');
}

startServer();

function startServer() {
  if (TRANSPORT === 'stdio') {
    startStdioTransport();
  } else {
    startWebSocketTransport();
  }
}

function detectTransport() {
  const argv = process.argv.slice(2);
  if (argv.includes('--stdio')) {
    return 'stdio';
  }
  if (argv.includes('--ws')) {
    return 'ws';
  }
  const envTransport = (process.env.MCP_TRANSPORT || '').toLowerCase();
  if (envTransport === 'stdio' || envTransport === 'ws') {
    return envTransport;
  }
  return 'ws';
}

function loadWorkflows() {
  const explicitJson = process.env.N8N_MCP_WORKFLOWS;
  const explicitFile = process.env.N8N_MCP_WORKFLOWS_FILE;
  const searchPaths = [];

  if (explicitJson) {
    const parsed = parseWorkflowsJson(explicitJson, 'environment variable N8N_MCP_WORKFLOWS');
    if (parsed) {
      return parsed;
    }
  }

  if (explicitFile) {
    searchPaths.push(path.resolve(explicitFile));
  }

  searchPaths.push(path.resolve(__dirname, 'workflows.json'));

  for (const candidate of searchPaths) {
    if (candidate && fs.existsSync(candidate)) {
      try {
        const contents = fs.readFileSync(candidate, 'utf8');
        const parsed = parseWorkflowsJson(contents, candidate);
        if (parsed) {
          return parsed;
        }
      } catch (error) {
        console.error(`[mcp:n8n] Failed to read workflows file "${candidate}":`, error);
      }
    }
  }

  return [];
}

function parseWorkflowsJson(raw, sourceLabel) {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.error(`[mcp:n8n] Workflows definition from ${sourceLabel} must be an array.`);
      return null;
    }
    const valid = parsed
      .map((wf, index) => normalizeWorkflow(wf, `${sourceLabel}[${index}]`))
      .filter(Boolean);
    return valid;
  } catch (error) {
    console.error(`[mcp:n8n] Failed to parse workflows JSON from ${sourceLabel}:`, error.message);
    return null;
  }
}

function normalizeWorkflow(raw, label) {
  if (!raw || typeof raw !== 'object') {
    console.warn(`[mcp:n8n] Ignoring workflow at ${label}: expected an object.`);
    return null;
  }

  const id = String(raw.id || '').trim();
  const name = String(raw.name || raw.id || '').trim();
  const description = typeof raw.description === 'string' ? raw.description.trim() : '';
  const webhookPath = typeof raw.webhookPath === 'string' ? raw.webhookPath.trim() : '';
  const method = (raw.method || 'POST').toString().trim().toUpperCase();

  if (!id) {
    console.warn(`[mcp:n8n] Workflow at ${label} is missing required "id".`);
    return null;
  }

  if (!webhookPath) {
    console.warn(`[mcp:n8n] Workflow "${id}" is missing required "webhookPath".`);
    return null;
  }

  const allowedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
  if (!allowedMethods.has(method)) {
    console.warn(`[mcp:n8n] Workflow "${id}" uses unsupported method "${method}". Falling back to POST.`);
  }

  const headers = isPlainObject(raw.headers) ? sanitizeHeaderMap(raw.headers) : {};
  const query = isPlainObject(raw.query) ? raw.query : {};
  const defaultPayload = raw.defaultPayload && isPlainObject(raw.defaultPayload) ? raw.defaultPayload : undefined;

  return {
    id,
    name: name || id,
    description,
    webhookPath,
    method: allowedMethods.has(method) ? method : 'POST',
    headers,
    query,
    defaultPayload
  };
}

function sanitizeBaseUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\/+$/, '');
}

function sanitizeHeaderMap(input) {
  return Object.entries(input).reduce((acc, [key, value]) => {
    if (typeof key === 'string' && key.trim()) {
      acc[key.trim()] = typeof value === 'string' ? value : String(value);
    }
    return acc;
  }, {});
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function startWebSocketTransport() {
  const server = http.createServer();
  const wss = new WebSocketServer({ server });

  wss.on('connection', (socket) => {
    const sendJson = (payload) => {
      try {
        socket.send(JSON.stringify(payload));
      } catch (error) {
        console.error('[mcp:n8n][ws] Failed to send response:', error);
      }
    };

    socket.on('message', async (data) => {
      const messages = splitRawMessages(data.toString());
      for (const raw of messages) {
        await handleRawMessage(raw, sendJson);
      }
    });

    socket.on('error', (error) => {
      console.error('[mcp:n8n][ws] Connection error:', error);
    });
  });

  server.listen(DEFAULT_WS_PORT, () => {
    console.log(`[mcp:n8n] MCP WebSocket transport listening on ws://localhost:${DEFAULT_WS_PORT}`);
  });
}

function startStdioTransport() {
  console.log('[mcp:n8n] MCP STDIO transport started. Awaiting messages...');
  let buffer = '';

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async (chunk) => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const raw = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!raw) {
        continue;
      }
      await handleRawMessage(raw, (payload) => {
        process.stdout.write(`${JSON.stringify(payload)}\n`);
      });
    }
  });

  process.stdin.on('end', () => process.exit(0));
}

function splitRawMessages(raw) {
  if (!raw.includes('\n')) {
    return [raw];
  }
  return raw
    .split('\n')
    .map((part) => part.trim())
    .filter(Boolean);
}

async function handleRawMessage(raw, sendJson) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch (error) {
    sendJson(makeJsonError(null, -32700, 'Failed to parse JSON message', { raw }));
    return;
  }

  try {
    await handleMessage(message, sendJson);
  } catch (error) {
    const id = typeof message === 'object' ? message.id ?? null : null;
    sendJson(makeJsonError(id, -32603, 'Unhandled server error', serializeError(error)));
  }
}

async function handleMessage(message, sendJson) {
  if (!message || typeof message !== 'object') {
    sendJson(makeJsonError(null, -32600, 'Invalid request payload'));
    return;
  }

  const { jsonrpc, method } = message;
  const id = message.id ?? null;

  if (jsonrpc && jsonrpc !== JSONRPC_VERSION) {
    sendJson(makeJsonError(id, -32600, `Unsupported jsonrpc version "${jsonrpc}"`));
    return;
  }

  if (!method || typeof method !== 'string') {
    sendJson(makeJsonError(id, -32600, 'Missing method'));
    return;
  }

  const normalizedMethod = normalizeMethod(method);

  switch (normalizedMethod) {
    case 'initialize':
      sendJson({
        jsonrpc: JSONRPC_VERSION,
        id,
        result: {
          serverInfo,
          capabilities: buildCapabilities()
        }
      });
      break;
    case 'list_resources':
      sendJson({
        jsonrpc: JSONRPC_VERSION,
        id,
        result: {
          resources: workflows.map(formatResource)
        }
      });
      break;
    case 'read_resource': {
      const uri = message.params?.uri || message.params?.resource?.uri;
      if (typeof uri !== 'string') {
        sendJson(makeJsonError(id, -32602, 'read_resource requires a string "uri" parameter'));
        return;
      }
      const resource = readResource(uri);
      if (!resource) {
        sendJson(makeJsonError(id, -32602, `Resource not found for uri "${uri}"`));
        return;
      }
      sendJson({
        jsonrpc: JSONRPC_VERSION,
        id,
        result: {
          resource
        }
      });
      break;
    }
    case 'list_tools':
      sendJson({
        jsonrpc: JSONRPC_VERSION,
        id,
        result: {
          tools: listTools()
        }
      });
      break;
    case 'call_tool': {
      const params = message.params || {};
      const toolName = params.name || params.tool || params.toolName || params.identifier;
      const toolInput = params.arguments || params.input || params.payload || {};
      if (typeof toolName !== 'string' || !toolName.trim()) {
        sendJson(makeJsonError(id, -32602, 'call_tool requires a non-empty string tool name'));
        return;
      }
      try {
        const toolResult = await executeTool(toolName.trim(), toolInput);
        sendJson({
          jsonrpc: JSONRPC_VERSION,
          id,
          result: {
            success: true,
            tool: toolName.trim(),
            data: toolResult
          }
        });
      } catch (error) {
        sendJson(makeJsonError(id, -32000, error.message, serializeError(error)));
      }
      break;
    }
    case 'ping':
      sendJson({
        jsonrpc: JSONRPC_VERSION,
        id,
        result: { ok: true, transport: TRANSPORT, serverInfo }
      });
      break;
    default:
      sendJson(makeJsonError(id, -32601, `Unknown method "${method}"`));
      break;
  }
}

function normalizeMethod(method) {
  const lower = method.toLowerCase();
  const map = {
    initialize: 'initialize',
    'resources.list': 'list_resources',
    'resources/list': 'list_resources',
    list_resources: 'list_resources',
    'resources.read': 'read_resource',
    'resources/read': 'read_resource',
    read_resource: 'read_resource',
    'tools.list': 'list_tools',
    'tools/list': 'list_tools',
    list_tools: 'list_tools',
    'tools.call': 'call_tool',
    'tools/call': 'call_tool',
    call_tool: 'call_tool',
    ping: 'ping'
  };

  return map[lower] || method;
}

function buildCapabilities() {
  return {
    resources: {
      list: true,
      read: true
    },
    tools: {
      list: true,
      call: true
    }
  };
}

function formatResource(workflow) {
  return {
    uri: `n8n://workflow/${workflow.id}`,
    name: workflow.name,
    description: workflow.description,
    metadata: {
      webhookPath: workflow.webhookPath,
      method: workflow.method,
      hasDefaultPayload: Boolean(workflow.defaultPayload),
      defaultQuery: Object.keys(workflow.query || {}).length > 0
    }
  };
}

function readResource(uri) {
  const workflowId = extractWorkflowId(uri);
  if (!workflowId) {
    return null;
  }

  const workflow = workflowMap.get(workflowId);
  if (!workflow) {
    return null;
  }

  const info = {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    method: workflow.method,
    webhookPath: workflow.webhookPath,
    headers: workflow.headers,
    query: workflow.query,
    defaultPayload: workflow.defaultPayload || null
  };

  return {
    uri: `n8n://workflow/${workflow.id}`,
    mimeType: 'application/json',
    text: JSON.stringify(info, null, 2),
    data: info
  };
}

function extractWorkflowId(uri) {
  if (typeof uri !== 'string') {
    return null;
  }
  const match = uri.match(/^n8n:\/\/workflow\/(.+)$/);
  return match ? match[1] : null;
}

function listTools() {
  return [
    {
      name: 'triggerWorkflow',
      description: 'Invoke a configured n8n workflow webhook and return the response payload.',
      inputSchema: {
        type: 'object',
        required: ['workflowId'],
        properties: {
          workflowId: {
            type: 'string',
            description: 'Identifier of the target workflow as defined in the MCP configuration.'
          },
          payload: {
            type: ['object', 'null'],
            description: 'Optional JSON payload to send with the request for non-GET methods.'
          },
          query: {
            type: ['object', 'null'],
            description: 'Optional query parameters to append to the webhook request.'
          },
          headers: {
            type: ['object', 'null'],
            description: 'Optional headers to merge with the workflow defaults.'
          },
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
            description: 'Override the configured HTTP method.'
          },
          webhookPath: {
            type: 'string',
            description: 'Override the configured webhook path for the workflow.'
          }
        },
        additionalProperties: false
      }
    },
    {
      name: 'listWorkflows',
      description: 'Return a catalog of the configured n8n workflows.',
      inputSchema: {
        type: 'object',
        additionalProperties: false
      }
    }
  ];
}

async function executeTool(name, input) {
  switch (name) {
    case 'triggerWorkflow':
      return triggerWorkflow(input);
    case 'listWorkflows':
      return workflows.map((workflow) => ({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        webhookPath: workflow.webhookPath,
        method: workflow.method
      }));
    default:
      throw new Error(`Tool "${name}" is not supported.`);
  }
}

async function triggerWorkflow(input) {
  if (!n8nBaseUrl) {
    throw new Error('N8N_BASE_URL is not configured. Set it in the environment to enable workflow execution.');
  }

  if (!isPlainObject(input)) {
    throw new Error('Tool input must be an object.');
  }

  const workflowId = typeof input.workflowId === 'string' ? input.workflowId.trim() : '';
  if (!workflowId) {
    throw new Error('workflowId is required to trigger a workflow.');
  }

  const workflow = workflowMap.get(workflowId);
  if (!workflow) {
    throw new Error(`Unknown workflow "${workflowId}".`);
  }

  const method = (input.method || workflow.method || 'POST').toString().trim().toUpperCase();
  const webhookPath = (input.webhookPath || workflow.webhookPath || '').trim();

  if (!webhookPath) {
    throw new Error(`Workflow "${workflowId}" does not define a webhook path.`);
  }

  const allowedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
  if (!allowedMethods.has(method)) {
    throw new Error(`Unsupported HTTP method "${method}".`);
  }

  const url = buildWebhookUrl(webhookPath);

  const mergedQuery = {
    ...(isPlainObject(workflow.query) ? workflow.query : {}),
    ...(isPlainObject(input.query) ? input.query : {})
  };

  for (const [key, value] of Object.entries(mergedQuery)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      value.forEach((part) => url.searchParams.append(key, String(part)));
    } else {
      url.searchParams.append(key, String(value));
    }
  }

  let payload = input.payload ?? workflow.defaultPayload;
  if (payload !== undefined && payload !== null && !isPlainObject(payload)) {
    throw new Error('payload must be an object when provided.');
  }

  const mergedHeaders = {
    ...(workflow.headers || {}),
    ...(isPlainObject(input.headers) ? sanitizeHeaderMap(input.headers) : {})
  };

  if (n8nApiKey && !hasAuthHeader(mergedHeaders)) {
    mergedHeaders[API_KEY_HEADER] = n8nApiKey;
  }

  let body;
  if (method === 'GET' || method === 'HEAD') {
    if (payload && Object.keys(payload).length > 0) {
      for (const [key, value] of Object.entries(payload)) {
        if (value === undefined || value === null) {
          continue;
        }
        if (Array.isArray(value)) {
          value.forEach((part) => url.searchParams.append(key, String(part)));
        } else {
          url.searchParams.append(key, String(value));
        }
      }
    }
    body = undefined;
  } else if (payload && Object.keys(payload).length > 0) {
    mergedHeaders['Content-Type'] = mergedHeaders['Content-Type'] || 'application/json';
    body = JSON.stringify(payload);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const start = Date.now();

  try {
    const response = await fetch(url, {
      method,
      headers: mergedHeaders,
      body,
      signal: controller.signal
    });

    const durationMs = Date.now() - start;
    const rawBody = await response.text();
    let parsedJson = null;

    if (rawBody) {
      try {
        parsedJson = JSON.parse(rawBody);
      } catch {
        parsedJson = null;
      }
    }

    const preview = rawBody.slice(0, BODY_PREVIEW_LIMIT);
    const truncated = rawBody.length > BODY_PREVIEW_LIMIT;

    return {
      workflowId: workflow.id,
      workflowName: workflow.name,
      request: {
        url: url.toString(),
        method,
        headers: mergedHeaders,
        hasBody: Boolean(body)
      },
      response: {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        bodyPreview: preview,
        bodyPreviewTruncated: truncated,
        json: parsedJson
      },
      timing: {
        durationMs,
        startedAt: new Date(start).toISOString(),
        completedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request to workflow "${workflowId}" timed out after ${DEFAULT_TIMEOUT_MS}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function buildWebhookUrl(webhookPath) {
  const normalizedPath = webhookPath.replace(/^\/+/, '');
  return new URL(normalizedPath, `${n8nBaseUrl}/`);
}

function hasAuthHeader(headers) {
  if (!headers) {
    return false;
  }
  const keys = Object.keys(headers).map((key) => key.toLowerCase());
  return keys.includes('authorization') || keys.includes(API_KEY_HEADER.toLowerCase());
}

function makeJsonError(id, code, message, data) {
  const error = {
    jsonrpc: JSONRPC_VERSION,
    id,
    error: {
      code,
      message
    }
  };
  if (data !== undefined) {
    error.error.data = data;
  }
  return error;
}

function serializeError(error) {
  if (!error || typeof error !== 'object') {
    return { message: String(error) };
  }
  const serializable = {
    message: error.message || String(error),
    name: error.name || 'Error'
  };
  if (error.stack) {
    serializable.stack = error.stack;
  }
  return serializable;
}
