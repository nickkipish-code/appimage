# n8n MCP Integration for Cursor Mobile

This guide explains how to configure the n8n MCP server for use with Cursor Mobile.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env` file with:
   ```env
   N8N_API_URL=http://localhost:5678
   N8N_API_KEY=your-api-key-here
   ```

3. **Test the MCP server:**
   ```bash
   npm run mcp
   ```
   The server should start and wait for MCP protocol messages on stdio.

## Cursor Mobile Configuration

### Option 1: Using Cursor Settings

In Cursor Mobile, navigate to Settings → MCP Servers and add:

```json
{
  "n8n": {
    "command": "node",
    "args": ["/workspace/mcp-server.js"],
    "env": {
      "N8N_API_URL": "http://localhost:5678",
      "N8N_API_KEY": "your-api-key"
    }
  }
}
```

### Option 2: Using Environment Variables

If your `.env` file is in the workspace root, Cursor Mobile should automatically pick up the environment variables when running the MCP server.

## Using the Integration

Once configured, you can use n8n workflows directly in Cursor Mobile conversations:

### Example 1: List Workflows
```
List all my n8n workflows
```

### Example 2: Execute a Workflow
```
Execute the workflow named "Send Email Notification" with data: {"to": "user@example.com", "subject": "Hello"}
```

### Example 3: Check Execution Status
```
What's the status of execution exec-123?
```

### Example 4: Trigger Webhook
```
Trigger the webhook at /webhook/my-workflow with POST data: {"event": "user_signup"}
```

## Available Commands

The MCP server provides these tools that Cursor Mobile can use:

1. **n8n_list_workflows** - List all workflows
2. **n8n_execute_workflow** - Execute a workflow by ID or name
3. **n8n_get_workflow_status** - Get execution status
4. **n8n_get_workflow** - Get workflow details
5. **n8n_webhook_trigger** - Trigger via webhook

## Troubleshooting

### Server Won't Start
- Check that Node.js 18+ is installed
- Verify all dependencies are installed: `npm install`
- Check the MCP server file is executable: `chmod +x mcp-server.js`

### Connection to n8n Fails
- Verify `N8N_API_URL` is correct
- Check if n8n instance is running and accessible
- Verify API key if authentication is required
- Test n8n API directly: `curl http://localhost:5678/api/v1/workflows`

### Tools Not Available in Cursor Mobile
- Restart Cursor Mobile after configuration changes
- Check MCP server logs for errors
- Verify the MCP server is running: `npm run mcp`

## Advanced Configuration

### Using n8n Cloud

For n8n Cloud instances:
```env
N8N_API_URL=https://your-instance.n8n.cloud
N8N_API_KEY=your-cloud-api-key
```

### Using Self-Hosted n8n

For self-hosted instances:
```env
N8N_API_URL=https://n8n.yourdomain.com
N8N_API_KEY=your-api-key
```

### Custom API Endpoints

The service automatically tries multiple API endpoint formats:
- `/api/v1/workflows` (n8n Cloud/Enterprise)
- `/rest/workflows` (self-hosted)

If your instance uses a different format, you may need to modify `services/n8nService.js`.

## Security Notes

- Never commit your `.env` file with API keys
- Use environment variables for sensitive data
- Consider using Cursor Mobile's secure credential storage
- For production, use proper authentication and HTTPS

## Next Steps

- Explore your workflows: Ask Cursor Mobile to list workflows
- Test execution: Try executing a simple workflow
- Integrate with your code: Use workflow results in your development workflow

For more details, see `MCP_SETUP.md`.
