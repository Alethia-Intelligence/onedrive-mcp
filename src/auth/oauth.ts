import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import open from "open";
import { logger } from "../utils/logger.js";
import type { GraphTokenResponse, StoredTokens } from "../types/onedrive.js";

const AUTHORIZE_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";

const SCOPES = ["files.readwrite", "offline_access", "user.read"];

const TOKEN_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || "~",
  ".onedrive-mcp"
);
const TOKEN_PATH = path.join(TOKEN_DIR, "tokens.json");

export function getTokenPath(): string {
  return TOKEN_PATH;
}

function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function loadStoredTokens(): StoredTokens | null {
  try {
    if (!fs.existsSync(TOKEN_PATH)) return null;
    const data = fs.readFileSync(TOKEN_PATH, "utf-8");
    return JSON.parse(data) as StoredTokens;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: StoredTokens): void {
  if (!fs.existsSync(TOKEN_DIR)) {
    fs.mkdirSync(TOKEN_DIR, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), {
    mode: 0o600,
  });
}

export async function refreshAccessToken(
  tokens: StoredTokens
): Promise<StoredTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: tokens.client_id,
    scope: SCOPES.join(" "),
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${error}`);
  }

  const data = (await response.json()) as GraphTokenResponse;

  const updated: StoredTokens = {
    ...tokens,
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
    refresh_token: data.refresh_token || tokens.refresh_token,
  };

  saveTokens(updated);
  return updated;
}

export async function runAuthFlow(): Promise<void> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;

  if (!clientId) {
    logger.error(
      "Missing MICROSOFT_CLIENT_ID environment variable.\n" +
        "Set it before running auth:\n" +
        "  export MICROSOFT_CLIENT_ID=your_client_id"
    );
    process.exit(1);
  }

  const port = 8888;
  const redirectUri = `http://localhost:${port}/callback`;
  const state = randomBytes(16).toString("hex");
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const authUrl = new URL(AUTHORIZE_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", SCOPES.join(" "));
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  return new Promise<void>((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url!, `http://127.0.0.1:${port}`);

        if (url.pathname !== "/callback") {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        const error = url.searchParams.get("error");
        if (error) {
          const description = url.searchParams.get("error_description") || "";
          res.writeHead(400);
          res.end(`Authorization failed: ${error} — ${description}`);
          server.close();
          reject(new Error(`Authorization failed: ${error} — ${description}`));
          return;
        }

        const code = url.searchParams.get("code");
        const returnedState = url.searchParams.get("state");

        if (returnedState !== state) {
          res.writeHead(400);
          res.end("State mismatch — possible CSRF attack");
          server.close();
          reject(new Error("State mismatch"));
          return;
        }

        if (!code) {
          res.writeHead(400);
          res.end("No authorization code received");
          server.close();
          reject(new Error("No authorization code"));
          return;
        }

        const tokenBody = new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          code_verifier: codeVerifier,
          scope: SCOPES.join(" "),
        });

        const tokenResponse = await fetch(TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: tokenBody.toString(),
        });

        if (!tokenResponse.ok) {
          const errText = await tokenResponse.text();
          res.writeHead(500);
          res.end(`Token exchange failed: ${errText}`);
          server.close();
          reject(new Error(`Token exchange failed: ${errText}`));
          return;
        }

        const tokenData = (await tokenResponse.json()) as GraphTokenResponse;

        const storedTokens: StoredTokens = {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token!,
          expires_at: Date.now() + tokenData.expires_in * 1000,
          client_id: clientId,
        };

        saveTokens(storedTokens);

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<html><body><h1>Authorization Successful!</h1>" +
            "<p>You can close this window and return to the terminal.</p>" +
            "</body></html>"
        );

        logger.info(`Tokens saved to ${TOKEN_PATH}`);
        server.close();
        resolve();
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    server.listen(port, "127.0.0.1", () => {
      logger.info(`Listening on http://127.0.0.1:${port}/callback`);
      logger.info("Opening browser for Microsoft authorization...");
      open(authUrl.toString()).catch(() => {
        logger.info(`Open this URL manually:\n${authUrl.toString()}`);
      });
    });

    server.on("error", (err) => {
      reject(new Error(`Failed to start auth server: ${err.message}`));
    });
  });
}
