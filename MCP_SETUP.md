# n8n MCP Integration Setup Guide

This guide explains how to set up the n8n Model Context Protocol (MCP) server for use with Cursor Mobile.

## Overview

The MCP server provides Cursor Mobile with access to n8n workflows, allowing you to:
- List available workflows
- Execute workflows
- Check execution status
- Trigger webhooks
- Get workflow details

## Prerequisites

1. Node.js 18+ installed
2. An n8n instance (local or cloud)
3. n8n API key (optional but recommended)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```env
N8N_API_URL=http://localhost:5678
N8N_API_KEY=your-n8n-api-key-here
```

For n8n Cloud or self-hosted instances:
```env
N8N_API_URL=https://your-instance.n8n.cloud
N8N_API_KEY=your-api-key
```

## MCP Server Configuration

### For Cursor Desktop

Add to your Cursor settings (usually `~/.cursor/mcp.json` or similar):

```json
{
  "mcpServers": {
    "n8n": {
      "command": "node",
      "args": ["/workspace/mcp-server.js"],
      "env": {
        "N8N_API_URL": "http://localhost:5678",
        "N8N_API_KEY": "your-api-key"
      }
    }
  }
}
```

### For Cursor Mobile

The MCP server can be configured through Cursor Mobile's settings. The server communicates via stdio and will automatically use environment variables from your `.env` file.

## Available Tools

### 1. `n8n_list_workflows`
List all available n8n workflows.

**Parameters:**
- `active` (optional): Filter by active status (true/false)

**Example:**
```json
{
  "name": "n8n_list_workflows",
  "arguments": {
    "active": true
  }
}
```

### 2. `n8n_execute_workflow`
Execute an n8n workflow.

**Parameters:**
- `workflowId` (required): The workflow ID
- `workflowName` (optional): Alternative to workflowId - find by name
- `inputData` (optional): Data to pass to the workflow

**Example:**
```json
{
  "name": "n8n_execute_workflow",
  "arguments": {
    "workflowId": "123",
    "inputData": {
      "name": "John",
      "email": "john@example.com"
    }
  }
}
```

### 3. `n8n_get_workflow_status`
Get the execution status of a workflow.

**Parameters:**
- `executionId` (required): The execution ID

**Example:**
```json
{
  "name": "n8n_get_workflow_status",
  "arguments": {
    "executionId": "exec-123"
  }
}
```

### 4. `n8n_get_workflow`
Get details of a specific workflow.

**Parameters:**
- `workflowId` (required): The workflow ID

**Example:**
```json
{
  "name": "n8n_get_workflow",
  "arguments": {
    "workflowId": "123"
  }
}
```

### 5. `n8n_webhook_trigger`
Trigger an n8n workflow via webhook.

**Parameters:**
- `webhookPath` (required): The webhook path or full URL
- `method` (optional): HTTP method (GET, POST, PUT, DELETE, PATCH) - default: POST
- `data` (optional): Data to send to the webhook

**Example:**
```json
{
  "name": "n8n_webhook_trigger",
  "arguments": {
    "webhookPath": "my-webhook",
    "method": "POST",
    "data": {
      "event": "user_signup",
      "userId": "123"
    }
  }
}
```

## Available Resources

The MCP server exposes n8n workflows as resources that can be read:

- `n8n://workflow/{workflowId}` - Access workflow details as a resource

## Testing the MCP Server

You can test the MCP server directly:

```bash
npm run mcp
```

The server will run on stdio and wait for MCP protocol messages.

## Troubleshooting

### Connection Issues

1. **Check n8n URL**: Ensure `N8N_API_URL` points to your n8n instance
2. **Verify API Key**: If authentication is required, set `N8N_API_KEY`
3. **Network Access**: Ensure the MCP server can reach your n8n instance

### API Endpoint Issues

The service tries multiple API endpoints:
- `/api/v1/workflows` (n8n Cloud/Enterprise)
- `/rest/workflows` (self-hosted)

If you encounter 404 errors, check which API version your n8n instance uses.

### Authentication

For n8n Cloud or instances with authentication enabled:
1. Generate an API key in n8n settings
2. Set it in `.env` as `N8N_API_KEY`
3. The service will automatically include it in requests

## Example Use Cases

1. **Automated Workflow Execution**: Trigger n8n workflows from Cursor Mobile
2. **Workflow Discovery**: List and explore available workflows
3. **Status Monitoring**: Check execution status of long-running workflows
4. **Webhook Integration**: Trigger workflows via webhooks with custom data

## Support

For issues or questions:
- Check n8n API documentation: https://docs.n8n.io/api/
- Review MCP protocol documentation
- Check Cursor Mobile MCP integration docs
