# OneDrive MCP Server — Implementation Plan

## Overview

A Model Context Protocol (MCP) server for Microsoft OneDrive, built with TypeScript following the same architecture as the SpotifyMCP reference project. Uses the Microsoft Graph API v1.0 for all OneDrive operations. Supports stdio transport for integration with Claude Desktop/Code.

---

## Tech Stack

| Component | Choice |
|---|---|
| Language | TypeScript 5.7+ (strict mode) |
| Runtime | Node.js 18+ (ES2022, ESM) |
| MCP SDK | `@modelcontextprotocol/sdk` |
| Validation | `zod` |
| Browser open | `open` |
| Build | `tsc` → `dist/` |
| Transport | Stdio (StdioServerTransport) |

---

## Project Structure

```
onedrive-mcp/
├── src/
│   ├── index.ts                          # Entry point (auth mode or server mode)
│   ├── api/
│   │   └── client.ts                     # Microsoft Graph API client (auth, retry, cache)
│   ├── auth/
│   │   └── oauth.ts                      # OAuth 2.0 Code Flow with Microsoft identity
│   ├── cache/
│   │   └── cache.ts                      # In-memory TTL cache (same as Spotify reference)
│   ├── tools/
│   │   ├── index.ts                      # registerAllTools() hub
│   │   ├── search-files.ts              # Search files/folders by query
│   │   ├── list-children.ts             # List contents of a folder
│   │   ├── get-item-metadata.ts         # Get metadata for a file/folder
│   │   ├── read-file-content.ts         # Download/read file content (text files)
│   │   ├── create-folder.ts             # Create a new folder
│   │   ├── upload-file.ts               # Upload/create a file (small ≤4MB, session >4MB)
│   │   ├── update-file-content.ts       # Update/overwrite an existing file's content
│   │   ├── update-item-metadata.ts      # Rename or move a file/folder
│   │   ├── delete-item.ts              # Delete a file/folder (recycle bin)
│   │   ├── copy-item.ts               # Copy a file/folder
│   │   ├── share-item.ts              # Create sharing link / manage permissions
│   │   └── get-drive-info.ts           # Get drive info and quota
│   ├── types/
│   │   └── onedrive.ts                  # TypeScript interfaces for Graph API responses
│   └── utils/
│       ├── errors.ts                    # Custom error classes
│       └── logger.ts                    # stderr-safe logger
├── package.json
├── tsconfig.json
├── README.md
└── .env.example
```

---

## Authentication

### Microsoft OAuth 2.0 Authorization Code Flow

**Endpoints:**
- Authorize: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
- Token: `https://login.microsoftonline.com/common/oauth2/v2.0/token`

**Scopes:**
```
files.readwrite.all offline_access user.read
```

**Flow (same pattern as Spotify MCP):**
1. `npm run auth` → opens browser to Microsoft login
2. Local callback server on `http://127.0.0.1:8888/callback`
3. Exchange authorization code for access + refresh tokens
4. Store tokens at `~/.onedrive-mcp/tokens.json` (mode 0o600)
5. On server start, load tokens; auto-refresh 60s before expiry

**Environment Variables:**
- `MICROSOFT_CLIENT_ID` — Azure App Registration client ID
- `MICROSOFT_CLIENT_SECRET` — Azure App Registration client secret

---

## API Client

### GraphClient (mirrors SpotifyClient pattern)

**Base URL:** `https://graph.microsoft.com/v1.0`

**Features:**
- Bearer token authentication
- Automatic token refresh on 401 (single retry)
- Proactive token refresh 60s before expiry
- Retry logic (3 attempts) with exponential backoff
- Rate limit handling (429 with Retry-After)
- In-memory cache with per-request TTL
- Cache invalidation on mutations

---

## Tools (12 total)

### 1. `search_files` — Search files and folders
- **Endpoint:** `GET /me/drive/root/search(q='{query}')`
- **Params:** `query` (required), `limit` (optional, default 10)
- **Cache:** 3 min TTL
- **Returns:** List of matching items with name, path, size, modified date

### 2. `list_children` — List folder contents
- **Endpoint:** `GET /me/drive/root/children` or `GET /me/drive/items/{id}/children` or `GET /me/drive/root:/{path}:/children`
- **Params:** `path` (optional, default root), `item_id` (optional), `limit` (optional, default 50)
- **Cache:** 2 min TTL
- **Returns:** List of items in the folder with type, name, size, modified date

### 3. `get_item_metadata` — Get file/folder metadata
- **Endpoint:** `GET /me/drive/items/{id}` or `GET /me/drive/root:/{path}`
- **Params:** `path` (optional), `item_id` (optional) — one required
- **Cache:** 2 min TTL
- **Returns:** Full metadata including name, size, dates, parent, webUrl, hashes

### 4. `read_file_content` — Read/download file content
- **Endpoint:** `GET /me/drive/items/{id}/content`
- **Params:** `path` (optional), `item_id` (optional) — one required
- **Cache:** No cache (content may change)
- **Returns:** File content as text (for text-based files) or download URL info for binary files

### 5. `create_folder` — Create a new folder
- **Endpoint:** `POST /me/drive/items/{parent-id}/children` or `POST /me/drive/root/children`
- **Params:** `name` (required), `parent_path` (optional, default root), `conflict_behavior` (optional: "rename" | "fail" | "replace")
- **Cache:** Invalidates parent folder cache
- **Returns:** Created folder metadata

### 6. `upload_file` — Upload/create a file
- **Endpoint:** `PUT .../content` for ≤4MB; `createUploadSession` for >4MB
- **Params:** `parent_path` (required), `filename` (required), `content` (required, text content or base64), `conflict_behavior` (optional)
- **Cache:** Invalidates parent folder cache
- **Returns:** Created file metadata

### 7. `update_file_content` — Update an existing file's content
- **Endpoint:** `PUT /me/drive/items/{id}/content`
- **Params:** `path` (optional), `item_id` (optional) — one required; `content` (required)
- **Cache:** Invalidates item and parent cache
- **Returns:** Updated file metadata

### 8. `update_item_metadata` — Rename or move a file/folder
- **Endpoint:** `PATCH /me/drive/items/{id}`
- **Params:** `item_id` or `path` (one required), `new_name` (optional), `new_parent_path` (optional)
- **Cache:** Invalidates old and new parent cache
- **Returns:** Updated item metadata

### 9. `delete_item` — Delete a file/folder
- **Endpoint:** `DELETE /me/drive/items/{id}`
- **Params:** `path` (optional), `item_id` (optional) — one required
- **Cache:** Invalidates parent cache
- **Returns:** Confirmation message

### 10. `copy_item` — Copy a file/folder
- **Endpoint:** `POST /me/drive/items/{id}/copy`
- **Params:** `item_id` or `path` (one required), `destination_path` (required), `new_name` (optional)
- **Cache:** Invalidates destination cache
- **Returns:** Async operation status (copy is async in Graph API)

### 11. `share_item` — Create a sharing link
- **Endpoint:** `POST /me/drive/items/{id}/createLink`
- **Params:** `item_id` or `path` (one required), `type` ("view" | "edit"), `scope` ("anonymous" | "organization"), `expiration` (optional)
- **Cache:** No cache
- **Returns:** Sharing link URL and permission details

### 12. `get_drive_info` — Get drive information and storage quota
- **Endpoint:** `GET /me/drive`
- **Params:** None
- **Cache:** 5 min TTL
- **Returns:** Drive type, owner, total/used/remaining storage quota

---

## Error Handling

### Custom Error Classes (mirroring Spotify reference)
- `GraphApiError(message, statusCode, errors?)` — Generic Microsoft Graph error
- `AuthenticationError(message)` — Token/auth failures
- `RateLimitError(retryAfterMs)` — 429 throttling
- `ConfigurationError(message)` — Missing env vars or config
- `NotFoundError(message)` — 404 item not found
- `InsufficientPermissionsError(message)` — 403 access denied

### Error formatting
- `formatError(error)` → MCP-compatible `{ content: [{ type: "text", text }], isError: true }`
- Helpful messages (e.g., "Run `npm run auth` to re-authenticate")

---

## Types (src/types/onedrive.ts)

Key interfaces:
- `DriveItem` — File/folder representation
- `Drive` — Drive resource with quota
- `DriveItemFile` / `DriveItemFolder` — Facets
- `ItemReference` — Parent reference
- `Permission` — Sharing permission
- `UploadSession` — Large file upload session
- `ThumbnailSet` — Thumbnails
- `StoredTokens` — Persisted token structure
- `GraphTokenResponse` — Token endpoint response
- `GraphErrorResponse` — Error response envelope

---

## Configuration

### package.json
```json
{
  "name": "onedrive-mcp",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "auth": "node dist/index.js auth"
  }
}
```

### Claude Desktop/Code integration
```json
{
  "mcpServers": {
    "onedrive": {
      "command": "node",
      "args": ["/path/to/onedrive-mcp/dist/index.js"],
      "env": {
        "MICROSOFT_CLIENT_ID": "...",
        "MICROSOFT_CLIENT_SECRET": "..."
      }
    }
  }
}
```

---

## Implementation Order

### Phase 1 — Foundation (core infrastructure)
1. `package.json`, `tsconfig.json`, `.env.example`
2. `src/utils/logger.ts` — stderr-safe logger
3. `src/utils/errors.ts` — custom error classes
4. `src/cache/cache.ts` — in-memory TTL cache
5. `src/types/onedrive.ts` — TypeScript interfaces

### Phase 2 — Auth & Client
6. `src/auth/oauth.ts` — Microsoft OAuth 2.0 flow
7. `src/api/client.ts` — GraphClient with retry, cache, token refresh

### Phase 3 — Tools (read operations)
8. `src/tools/get-drive-info.ts`
9. `src/tools/list-children.ts`
10. `src/tools/get-item-metadata.ts`
11. `src/tools/search-files.ts`
12. `src/tools/read-file-content.ts`

### Phase 4 — Tools (write operations)
13. `src/tools/create-folder.ts`
14. `src/tools/upload-file.ts`
15. `src/tools/update-file-content.ts`
16. `src/tools/update-item-metadata.ts`
17. `src/tools/delete-item.ts`
18. `src/tools/copy-item.ts`
19. `src/tools/share-item.ts`

### Phase 5 — Entry point & integration
20. `src/tools/index.ts` — registerAllTools()
21. `src/index.ts` — Server entry point
22. `README.md` — Setup and usage documentation
