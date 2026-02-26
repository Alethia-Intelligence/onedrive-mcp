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
   - **Redirect URI:** Select **Web** and enter `http://127.0.0.1:8888/callback`
4. Click **Register**
5. On the app overview page, copy the **Application (client) ID**
6. Go to **Certificates & secrets** → **New client secret** → copy the secret **Value**
7. Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions** and add:
   - `Files.ReadWrite.All`
   - `User.Read`
   - `offline_access`

## Installation

```bash
git clone https://github.com/popand/onedrive-mcp.git
cd onedrive-mcp
npm install
npm run build
```

## Authentication

Set your Azure app credentials and run the auth flow:

```bash
export MICROSOFT_CLIENT_ID=your_client_id
export MICROSOFT_CLIENT_SECRET=your_client_secret
npm run auth
```

This opens a browser window for Microsoft login. After approval, tokens are saved to `~/.onedrive-mcp/tokens.json` (auto-refreshed on expiry).

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
        "MICROSOFT_CLIENT_ID": "your_client_id",
        "MICROSOFT_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

### Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "onedrive": {
      "command": "node",
      "args": ["/path/to/onedrive-mcp/dist/index.js"],
      "env": {
        "MICROSOFT_CLIENT_ID": "your_client_id",
        "MICROSOFT_CLIENT_SECRET": "your_client_secret"
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
Run `npm run auth` with `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` set as environment variables.

**"Token refresh failed"**
Your refresh token may have expired. Re-run `npm run auth` to re-authorize.

**"Insufficient permissions"**
Ensure your Azure app has `Files.ReadWrite.All`, `User.Read`, and `offline_access` permissions. You may need to re-consent by running `npm run auth` again.

**"Port 8888 already in use"**
Another process is using port 8888. Stop it or wait a moment and try `npm run auth` again.

**Build errors**
Make sure you have Node.js 18+ installed. Run `npm install` then `npm run build`.

## License

MIT
