# Cursor Mobile MCP + n8n Integration

This guide explains how to expose your n8n automations to Cursor Mobile through the Model Context Protocol (MCP). You will run the MCP server from this repository (`npm run mcp:n8n`) and point Cursor Mobile at it so that the assistant can list and execute n8n workflows from your phone.

> **TL;DR**
>
> 1. Provision access to an n8n instance and create an API token.  
> 2. Install project dependencies and start the MCP bridge:  
>    `N8N_BASE_URL=https://n8n.example.com N8N_API_KEY=xxxxx npm run mcp:n8n`  
> 3. Make the process reachable to Cursor Mobile (local network, SSH, or HTTPS).  
> 4. Register the server inside Cursor Mobile’s MCP settings.

---

## 1. Prerequisites

- **n8n instance** that Cursor may call (self-hosted or cloud).  
- **API key** with permissions to list and run the workflows you care about. Create one under *User Settings → Personal Access Tokens* (or use `N8N_API_KEY` on self-hosted builds).  
- **Node.js 18+** on the machine that will host the MCP bridge.  
- **Cursor Mobile** (iOS/Android) logged in with MCP access enabled.

Optional but recommended:

- A stable hostname/IP that the phone can reach (VPN, Tailscale, or HTTPS tunnel).  
- SSH access if you prefer Cursor to start the bridge over SSH.

---

## 2. Install dependencies

On the machine that will host the bridge:

```bash
git clone <this repo>
cd <repo>
npm install
```

---

## 3. Configure environment

Set the environment variables before launching the bridge:

- `N8N_BASE_URL` – Base URL of your n8n deployment (e.g. `https://n8n.example.com`).  
- `N8N_API_KEY` – Token created in n8n (or `N8N_PERSONAL_ACCESS_TOKEN` as a fallback).

Example:

```bash
export N8N_BASE_URL="https://n8n.example.com"
export N8N_API_KEY="pa_xxxxxxxxxxxxxxxxx"
```

Add additional variables if your n8n instance needs custom headers/proxies.

---

## 4. Start the MCP ↔︎ n8n bridge

```bash
npm run mcp:n8n
```

The command runs `node mcp/n8nServer.js`, which:

- Registers MCP tools:
  - `n8n.listWorkflows` – browse workflows, filter by tag or active state.
  - `n8n.executeWorkflow` – trigger a workflow immediately and optionally wait for completion.
  - `n8n.getExecution` – fetch details for a specific execution.
- Authenticates outgoing requests with `X-N8N-API-KEY`.

Keep this process running (tmux, screen, pm2, or a systemd unit) so that mobile clients can connect at any time.

---

## 5. Make the server reachable

Cursor Mobile must be able to reach the bridge process. Pick one of the patterns below:

### Option A – Same network (fastest)

1. Ensure the hosting machine and the phone are on the same Wi‑Fi or VPN.  
2. Expose the bridge via SSH or a TCP tunnel (Cursor Mobile currently connects over SSH/stdio).  
3. Confirm you can SSH into the host from another device using the same credentials.

### Option B – Remote host + SSH

1. Deploy the repo to a VPS.  
2. Create an SSH key pair for Cursor Mobile.  
3. Allow the user to run `npm run mcp:n8n` (e.g. via `~/.bashrc` or a systemd service).  
4. Use the SSH config inside Cursor Mobile (see step 6) to spawn the MCP server remotely.

### Option C – HTTPS endpoint (advanced)

If you need HTTPS/Web transport instead of SSH, front the process with a reverse proxy that speaks the MCP HTTP transport. The included script uses STDIO; swap to an HTTP transport if/when Cursor Mobile exposes it. You can adapt `mcp/n8nServer.js` to serve over HTTP once the SDK stabilises.

---

## 6. Register the server in Cursor Mobile

1. Open Cursor Mobile.  
2. Go to **Settings → Model Context Protocol**.  
3. Tap **Add Server**.  
4. Choose **SSH (stdio)** and fill in:
   - **Name**: `n8n automations`
   - **Host**: `<ip-or-hostname>`
   - **Port**: default `22` or custom SSH port
   - **User**: Linux username on the host
   - **Auth**: password or private key (recommend key)  
   - **Command**: `cd /path/to/repo && N8N_BASE_URL=... N8N_API_KEY=... npm run mcp:n8n`
5. Save. Cursor Mobile should show the server as “online” once it spawns successfully.

### (Optional) `cursor.mcp.json`

To keep the configuration under version control, create a file like this in your repo and import it from Cursor Mobile:

```json
{
  "mcpServers": {
    "n8n-automations": {
      "transport": "ssh",
      "ssh": {
        "host": "bridge.example.com",
        "port": 22,
        "user": "cursor",
        "forwardAgent": false
      },
      "command": "cd /workspace && npm run mcp:n8n",
      "env": {
        "N8N_BASE_URL": "https://n8n.example.com",
        "N8N_API_KEY": "pa_xxxxxxxxxxxx"
      }
    }
  }
}
```

Cursor Mobile can import this file through **Settings → Model Context Protocol → Import**.

---

## 7. Test the tools

In any conversation:

```text
/tool n8n.listWorkflows { "activeOnly": true }
```

Verify the assistant returns your workflows. Then try:

```text
/tool n8n.executeWorkflow { "workflowId": 12, "payload": { "customerId": "C1234" } }
```

Check `Executions` inside n8n to confirm the run completed.

---

## 8. Security checklist

- Restrict the SSH user (or API token) to only the workflows you intend to expose.  
- Rotate `N8N_API_KEY` regularly and treat it like a production secret.  
- Use VPN/Tailscale or firewalls to prevent the host from being scanned on the open internet.  
- For HTTPS deployments, terminate TLS in the reverse proxy and enforce authentication before the MCP transport.

---

## 9. Troubleshooting

| Problem | Fix |
| --- | --- |
| Cursor shows “server offline” | Verify the SSH command succeeds manually and that `npm run mcp:n8n` stays running. |
| “N8N_API_KEY is not set” warning | Export `N8N_API_KEY` (or `N8N_PERSONAL_ACCESS_TOKEN`) before starting the bridge. |
| `n8nFetch` errors | Confirm `N8N_BASE_URL` is correct and accessible from the host. Check HTTPS certificates. |
| Workflow runs indefinitely | Set `"waitForResult": false` when calling `n8n.executeWorkflow`, then poll with `n8n.getExecution`. |

---

## 10. Next steps

- Extend `mcp/n8nServer.js` with more tools (pause workflows, check logs).  
- Wrap the process with systemd or PM2 for auto-restart.  
- Share the `cursor.mcp.json` template across team members.

Happy automating! 🛠️📱
