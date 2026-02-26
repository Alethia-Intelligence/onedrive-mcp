import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GraphClient } from "../api/client.js";
import { registerSearchFiles } from "./search-files.js";
import { registerListChildren } from "./list-children.js";
import { registerGetItemMetadata } from "./get-item-metadata.js";
import { registerReadFileContent } from "./read-file-content.js";
import { registerGetDriveInfo } from "./get-drive-info.js";
import { registerCreateFolder } from "./create-folder.js";
import { registerUploadFile } from "./upload-file.js";
import { registerUpdateFileContent } from "./update-file-content.js";
import { registerUpdateItemMetadata } from "./update-item-metadata.js";
import { registerDeleteItem } from "./delete-item.js";
import { registerCopyItem } from "./copy-item.js";
import { registerShareItem } from "./share-item.js";

export function registerAllTools(server: McpServer, client: GraphClient): void {
  registerSearchFiles(server, client);
  registerListChildren(server, client);
  registerGetItemMetadata(server, client);
  registerReadFileContent(server, client);
  registerGetDriveInfo(server, client);
  registerCreateFolder(server, client);
  registerUploadFile(server, client);
  registerUpdateFileContent(server, client);
  registerUpdateItemMetadata(server, client);
  registerDeleteItem(server, client);
  registerCopyItem(server, client);
  registerShareItem(server, client);
}
