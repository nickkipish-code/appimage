#!/usr/bin/env node

/**
 * MCP Server for n8n Integration
 * Provides tools and resources for interacting with n8n workflows
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { n8nService } from './services/n8nService.js';

class N8nMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'n8n-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
    this.setupErrorHandling();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'n8n_list_workflows',
            description: 'List all available n8n workflows',
            inputSchema: {
              type: 'object',
              properties: {
                active: {
                  type: 'boolean',
                  description: 'Filter by active status (optional)',
                },
              },
            },
          },
          {
            name: 'n8n_execute_workflow',
            description: 'Execute an n8n workflow by ID or name',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'string',
                  description: 'The ID of the workflow to execute',
                },
                workflowName: {
                  type: 'string',
                  description: 'The name of the workflow to execute (alternative to ID)',
                },
                inputData: {
                  type: 'object',
                  description: 'Input data to pass to the workflow (optional)',
                },
              },
              required: ['workflowId'],
            },
          },
          {
            name: 'n8n_get_workflow_status',
            description: 'Get the execution status of a workflow',
            inputSchema: {
              type: 'object',
              properties: {
                executionId: {
                  type: 'string',
                  description: 'The execution ID to check',
                },
              },
              required: ['executionId'],
            },
          },
          {
            name: 'n8n_get_workflow',
            description: 'Get details of a specific workflow',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'string',
                  description: 'The ID of the workflow',
                },
              },
              required: ['workflowId'],
            },
          },
          {
            name: 'n8n_webhook_trigger',
            description: 'Trigger an n8n workflow via webhook',
            inputSchema: {
              type: 'object',
              properties: {
                webhookPath: {
                  type: 'string',
                  description: 'The webhook path or URL',
                },
                method: {
                  type: 'string',
                  description: 'HTTP method (GET, POST, etc.)',
                  enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
                  default: 'POST',
                },
                data: {
                  type: 'object',
                  description: 'Data to send to the webhook',
                },
              },
              required: ['webhookPath'],
            },
          },
        ],
      };
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      try {
        const workflows = await n8nService.listWorkflows();
        return {
          resources: workflows.map((workflow) => ({
            uri: `n8n://workflow/${workflow.id}`,
            name: workflow.name,
            description: workflow.description || `n8n workflow: ${workflow.name}`,
            mimeType: 'application/json',
          })),
        };
      } catch (error) {
        console.error('Error listing resources:', error);
        return {
          resources: [],
        };
      }
    });

    // Read resource (workflow details)
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      const match = uri.match(/^n8n:\/\/workflow\/(.+)$/);
      
      if (!match) {
        throw new Error(`Invalid resource URI: ${uri}`);
      }

      const workflowId = match[1];
      const workflow = await n8nService.getWorkflow(workflowId);
      
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(workflow, null, 2),
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'n8n_list_workflows': {
            const workflows = await n8nService.listWorkflows(args?.active);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(workflows, null, 2),
                },
              ],
            };
          }

          case 'n8n_execute_workflow': {
            const { workflowId, workflowName, inputData } = args;
            let id = workflowId;

            // If workflowName is provided, find the workflow by name
            if (!id && workflowName) {
              const workflows = await n8nService.listWorkflows();
              const workflow = workflows.find((w) => 
                w.name.toLowerCase() === workflowName.toLowerCase()
              );
              if (!workflow) {
                throw new Error(`Workflow not found: ${workflowName}`);
              }
              id = workflow.id;
            }

            if (!id) {
              throw new Error('Either workflowId or workflowName must be provided');
            }

            const execution = await n8nService.executeWorkflow(id, inputData);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(execution, null, 2),
                },
              ],
            };
          }

          case 'n8n_get_workflow_status': {
            const { executionId } = args;
            const status = await n8nService.getExecutionStatus(executionId);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(status, null, 2),
                },
              ],
            };
          }

          case 'n8n_get_workflow': {
            const { workflowId } = args;
            const workflow = await n8nService.getWorkflow(workflowId);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(workflow, null, 2),
                },
              ],
            };
          }

          case 'n8n_webhook_trigger': {
            const { webhookPath, method = 'POST', data } = args;
            const result = await n8nService.triggerWebhook(webhookPath, method, data);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('n8n MCP server running on stdio');
  }
}

const server = new N8nMCPServer();
server.run().catch(console.error);
