import process from 'node:process';
import { Application } from '@modelcontextprotocol/sdk';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/transports/stdio';

const N8N_BASE_URL = (process.env.N8N_BASE_URL || 'http://localhost:5678').replace(/\/+$/, '');
const N8N_API_KEY = process.env.N8N_API_KEY || process.env.N8N_PERSONAL_ACCESS_TOKEN;

const app = new Application({
  name: 'cursor-n8n-mcp',
  version: '0.1.0',
  description: 'Expose n8n workflows and executions via Model Context Protocol tools.'
});

const listWorkflowsInputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    activeOnly: {
      type: 'boolean',
      description: 'Return only workflows that are currently active (default: false).'
    },
    tag: {
      type: 'string',
      description: 'If provided, only workflows with this tag name will be returned.'
    }
  }
};

const listWorkflowsOutputSchema = {
  type: 'object',
  required: ['workflows'],
  properties: {
    workflows: {
      type: 'array',
      description: 'n8n workflows accessible to the authenticated user.',
      items: {
        type: 'object',
        required: ['id', 'name', 'active'],
        properties: {
          id: { type: ['string', 'number'] },
          name: { type: 'string' },
          active: { type: 'boolean' },
          tags: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: ['string', 'number'], nullable: true },
                name: { type: 'string' }
              }
            }
          },
          updatedAt: { type: 'string', nullable: true },
          createdAt: { type: 'string', nullable: true }
        }
      }
    }
  }
};

const executeWorkflowInputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['workflowId'],
  properties: {
    workflowId: {
      description: 'Workflow ID or UUID to execute.',
      oneOf: [
        { type: 'integer' },
        { type: 'string' }
      ]
    },
    payload: {
      type: 'object',
      nullable: true,
      description: 'Optional JSON payload that becomes the execution data.'
    },
    runData: {
      type: 'object',
      nullable: true,
      description: 'Optional run data (advanced).'
    },
    pinData: {
      type: 'object',
      nullable: true,
      description: 'Optional pin data to merge before execution.'
    },
    waitForResult: {
      type: 'boolean',
      default: true,
      description: 'Wait for the workflow execution to finish before returning (default true).'
    }
  }
};

const executeWorkflowOutputSchema = {
  type: 'object',
  required: ['executionId', 'status'],
  properties: {
    executionId: { type: 'string' },
    status: { type: 'string' },
    startedAt: { type: 'string', nullable: true },
    finishedAt: { type: 'string', nullable: true },
    data: { type: 'object', nullable: true }
  }
};

const getExecutionInputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['executionId'],
  properties: {
    executionId: {
      oneOf: [
        { type: 'integer' },
        { type: 'string' }
      ],
      description: 'Execution ID returned by executeWorkflow.'
    }
  }
};

const getExecutionOutputSchema = {
  type: 'object',
  required: ['execution'],
  properties: {
    execution: {
      type: 'object',
      description: 'The execution details returned by n8n.',
      properties: {},
      additionalProperties: true
    }
  }
};

function assertConfig() {
  if (!N8N_API_KEY) {
    throw new Error('N8N_API_KEY (or N8N_PERSONAL_ACCESS_TOKEN) environment variable is required to authenticate with n8n.');
  }
}

async function n8nFetch(path, init = {}) {
  assertConfig();

  const url = `${N8N_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const headers = new Headers(init.headers || {});
  headers.set('Accept', 'application/json');
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
  headers.set('X-N8N-API-KEY', N8N_API_KEY);

  const response = await fetch(url, { ...init, headers });

  if (!response.ok) {
    let message = `n8n request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody?.message) {
        message += ` – ${errorBody.message}`;
      } else if (errorBody?.error) {
        message += ` – ${errorBody.error}`;
      }
    } catch {
      // Ignore JSON parse errors
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

app.tool(
  'n8n.listWorkflows',
  {
    description: 'List workflows visible to the current n8n token.',
    inputSchema: listWorkflowsInputSchema,
    outputSchema: listWorkflowsOutputSchema
  },
  async ({ input }) => {
    const workflows = await n8nFetch('/rest/workflows');
    let items = Array.isArray(workflows?.data) ? workflows.data : workflows;

    if (!Array.isArray(items)) {
      throw new Error('Unexpected n8n response while listing workflows.');
    }

    if (input?.activeOnly) {
      items = items.filter((wf) => wf.active);
    }
    if (input?.tag) {
      const expectedTag = input.tag.toLowerCase();
      items = items.filter((wf) => {
        const tags = wf.tags || [];
        return tags.some((tag) => (tag.name || '').toLowerCase() === expectedTag);
      });
    }

    return {
      content: [
        {
          type: 'application/json',
          value: { workflows: items }
        }
      ]
    };
  }
);

app.tool(
  'n8n.executeWorkflow',
  {
    description: 'Execute an n8n workflow immediately and (optionally) wait for the result.',
    inputSchema: executeWorkflowInputSchema,
    outputSchema: executeWorkflowOutputSchema
  },
  async ({ input }) => {
    const { workflowId, payload = {}, runData = {}, pinData = {}, waitForResult = true } = input;

    const workflow = await n8nFetch(`/rest/workflows/${workflowId}`);

    if (!workflow || !workflow?.data) {
      throw new Error(`Workflow ${workflowId} could not be found or retrieved from n8n.`);
    }

    const execution = await n8nFetch('/rest/workflows/run', {
      method: 'POST',
      body: JSON.stringify({
        workflowData: workflow.data || workflow,
        runData,
        pinData,
        payload,
        executionMode: 'integrated',
        waitTill: waitForResult
      })
    });

    if (!execution) {
      throw new Error('n8n did not return an execution response.');
    }

    const result = {
      executionId: execution.id?.toString?.() || execution.executionId?.toString?.() || '',
      status: execution.status || execution.finished ? 'success' : 'running',
      startedAt: execution.startedAt || execution.started_at || null,
      finishedAt: execution.finishedAt || execution.finished_at || null,
      data: execution.data || execution.response || null
    };

    return {
      content: [
        {
          type: 'application/json',
          value: result
        }
      ]
    };
  }
);

app.tool(
  'n8n.getExecution',
  {
    description: 'Fetch details for a specific n8n workflow execution.',
    inputSchema: getExecutionInputSchema,
    outputSchema: getExecutionOutputSchema
  },
  async ({ input }) => {
    const execution = await n8nFetch(`/rest/executions/${input.executionId}`);

    return {
      content: [
        {
          type: 'application/json',
          value: { execution }
        }
      ]
    };
  }
);

async function main() {
  if (!N8N_API_KEY) {
    console.warn('[cursor-n8n-mcp] Warning: N8N_API_KEY is not set. Requests to n8n will fail until you provide a token.');
  }

  const transport = new StdioServerTransport();
  await app.connect(transport);
  await transport.run();
}

main().catch((error) => {
  console.error('[cursor-n8n-mcp] Fatal error:', error);
  process.exit(1);
});
