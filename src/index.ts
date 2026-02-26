#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { logger } from "./utils/logger.js";
import { runAuthFlow, loadStoredTokens } from "./auth/oauth.js";
import { GraphClient } from "./api/client.js";
import { registerAllTools } from "./tools/index.js";

async function runServer(): Promise<void> {
  const tokens = loadStoredTokens();

  if (!tokens) {
    logger.error(
      "No stored tokens found. Run 'npm run auth' to authorize with Microsoft first.\n" +
        "Make sure MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET are set as environment variables."
    );
    process.exit(1);
  }

  const client = new GraphClient(tokens);

  const server = new McpServer({
    name: "onedrive-mcp",
    version: "1.0.0",
  });

  registerAllTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("OneDrive MCP server started");
}

async function main(): Promise<void> {
  const command = process.argv[2];

  if (command === "auth") {
    await runAuthFlow();
    logger.info("Authorization complete!");
    process.exit(0);
  }

  await runServer();
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
