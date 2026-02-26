# OneDrive MCP Server

A Model Context Protocol (MCP) server that provides Claude with tools to interact with Microsoft OneDrive — browse files, read content, upload, copy, share, and manage your cloud storage.

## Prerequisites

- Node.js 18+
- A Microsoft account with OneDrive
- An Azure App Registration (free)

## Azure App Registration Setup

1. Go to the [Azure Portal](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Click **New registration**
3. Fill in the details:
   - **Name:** anything (e.g., "OneDrive MCP")
   - **Supported account types:** "Accounts in any organizational directory and personal Microsoft accounts"
4. Click **Register**
5. On the app overview page, copy the **Application (client) ID**
6. Go to **Authentication**:
   - Click **Add a platform** → **Mobile and desktop applications**
   - Enter custom redirect URI: `http://localhost:8888/callback`
   - Scroll to bottom → set **Allow public client flows** to **Yes**
   - Click **Save**
7. Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions** and add:
   - `Files.ReadWrite`
   - `User.Read`
   - `offline_access`

> **Note:** `Files.ReadWrite` only requires user consent. If you need access to files shared with you by others, use `Files.ReadWrite.All` instead (may require admin consent in enterprise tenants).

## Installation

```bash
git clone https://github.com/Alethia-Intelligence/onedrive-mcp.git
cd onedrive-mcp
npm install
npm run build
```

## Authentication

This server uses OAuth 2.0 with PKCE — no client secret needed, just your client ID.

```bash
export MICROSOFT_CLIENT_ID=your_client_id
npm run auth
```

This opens a browser window for Microsoft login. After approval, tokens are saved to `~/.onedrive-mcp/tokens.json` and auto-refresh on expiry.

## Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "onedrive": {
      "command": "node",
      "args": ["/path/to/onedrive-mcp/dist/index.js"],
      "env": {
        "MICROSOFT_CLIENT_ID": "your_client_id"
      }
    }
  }
}
```

### Claude Code

Add to `~/.claude/.mcp.json` (global) or your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "onedrive": {
      "command": "node",
      "args": ["/path/to/onedrive-mcp/dist/index.js"],
      "env": {
        "MICROSOFT_CLIENT_ID": "your_client_id"
      }
    }
  }
}
```

## Tools

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `search_files` | Search for files and folders by name or content | `query`, `limit` |
| `list_children` | List files and folders in a directory | `path`, `item_id`, `limit` |
| `get_item_metadata` | Get detailed metadata for a file or folder | `path`, `item_id` |
| `read_file_content` | Read text file content or get download URL for binary files | `path`, `item_id` |
| `get_drive_info` | Get OneDrive info and storage quota | — |
| `create_folder` | Create a new folder | `name`, `parent_path`, `conflict_behavior` |
| `upload_file` | Upload a text file | `parent_path`, `filename`, `content`, `conflict_behavior` |
| `update_file_content` | Update content of an existing file | `path`, `item_id`, `content` |
| `update_item_metadata` | Rename or move a file/folder | `item_id`, `path`, `new_name`, `new_parent_path` |
| `delete_item` | Delete a file or folder (moves to recycle bin) | `path`, `item_id` |
| `copy_item` | Copy a file or folder to another location | `item_id`, `path`, `destination_path`, `new_name` |
| `share_item` | Create a sharing link for a file or folder | `item_id`, `path`, `type`, `scope`, `expiration` |

## Example Usage

Ask Claude things like:
- "List the files in my Documents folder"
- "Search for files containing 'budget'"
- "Read the contents of Documents/notes.txt"
- "Upload a new file called todo.txt to my Documents folder"
- "Share my presentation with a view-only link"
- "How much OneDrive storage do I have left?"

## Troubleshooting

**"No stored tokens found"**
Run `npm run auth` with `MICROSOFT_CLIENT_ID` set as an environment variable.

**"Token refresh failed"**
Your refresh token may have expired. Re-run `npm run auth` to re-authorize.

**"Insufficient permissions"**
Ensure your Azure app has `Files.ReadWrite`, `User.Read`, and `offline_access` permissions. You may need to re-consent by running `npm run auth` again.

**"AADSTS50011: Redirect URI mismatch"**
Make sure your Azure app has `http://localhost:8888/callback` configured as a **Mobile and desktop applications** redirect URI (not Web).

**"AADSTS7000218: client_assertion or client_secret required"**
Your app is still configured as a confidential client. In Azure portal, go to **Authentication** → set **Allow public client flows** to **Yes**, and ensure the redirect URI is under **Mobile and desktop applications** (not Web).

**"AADSTS50194: not configured as multi-tenant"**
Go to **Authentication** → change **Supported account types** to "Accounts in any organizational directory and personal Microsoft accounts".

**"Need admin approval"**
You're using `Files.ReadWrite.All` which requires admin consent in enterprise tenants. Switch to `Files.ReadWrite` (user-only files) or ask your admin to grant consent.

**"Port 8888 already in use"**
Another process is using port 8888. Stop it or wait a moment and try `npm run auth` again.

**Build errors**
Make sure you have Node.js 18+ installed. Run `npm install` then `npm run build`.

## License

MIT
