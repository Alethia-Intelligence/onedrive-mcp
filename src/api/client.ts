import { Cache } from "../cache/cache.js";
import { logger } from "../utils/logger.js";
import {
  GraphApiError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  InsufficientPermissionsError,
} from "../utils/errors.js";
import { refreshAccessToken, saveTokens } from "../auth/oauth.js";
import type {
  StoredTokens,
  GraphErrorResponse,
} from "../types/onedrive.js";

const BASE_URL = "https://graph.microsoft.com/v1.0";

export class GraphClient {
  public cache: Cache;
  private tokens: StoredTokens;
  private maxRetries = 3;

  constructor(tokens: StoredTokens) {
    this.tokens = tokens;
    this.cache = new Cache();
  }

  async get<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
    cacheTtlMs?: number
  ): Promise<T> {
    return this.request<T>(path, { method: "GET", params, cacheTtlMs });
  }

  async post<T>(
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    return this.request<T>(path, { method: "POST", body });
  }

  async put<T>(
    path: string,
    body?: BodyInit,
    contentType?: string
  ): Promise<T> {
    return this.request<T>(path, {
      method: "PUT",
      rawBody: body,
      contentType,
    });
  }

  async patch<T>(
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    return this.request<T>(path, { method: "PATCH", body });
  }

  async delete(path: string): Promise<void> {
    await this.request<void>(path, { method: "DELETE" });
  }

  async getStream(path: string): Promise<Response> {
    await this.ensureValidToken();

    const url = new URL(`${BASE_URL}${path.startsWith("/") ? path : "/" + path}`);
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${this.tokens.access_token}` },
      redirect: "follow",
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    return response;
  }

  invalidateCache(pattern: RegExp): void {
    this.cache.invalidatePattern(pattern);
  }

  private async request<T>(
    path: string,
    options: RequestOptions
  ): Promise<T> {
    const { method = "GET", body, rawBody, contentType, params, cacheTtlMs } =
      options;

    const url = new URL(`${BASE_URL}${path.startsWith("/") ? path : "/" + path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const cacheKey = url.toString();

    if (method === "GET" && cacheTtlMs) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached !== undefined) {
        logger.debug(`Cache hit: ${cacheKey}`);
        return cached;
      }
    }

    await this.ensureValidToken();

    let lastError: unknown;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.tokens.access_token}`,
      };

      let fetchBody: BodyInit | undefined;

      if (rawBody !== undefined) {
        if (contentType) {
          headers["Content-Type"] = contentType;
        }
        fetchBody = rawBody;
      } else if (body) {
        headers["Content-Type"] = "application/json";
        fetchBody = JSON.stringify(body);
      }

      logger.debug(`${method} ${url.toString()}`);

      let response: Response;
      try {
        response = await fetch(url.toString(), {
          method,
          headers,
          body: fetchBody,
        });
      } catch (err) {
        lastError = err;
        if (attempt < this.maxRetries - 1) {
          const waitMs = 1000 * 2 ** attempt;
          logger.warn(
            `Network error, retrying in ${waitMs}ms (attempt ${attempt + 1}/${this.maxRetries})...`
          );
          await this.sleep(waitMs);
          continue;
        }
        throw err;
      }

      if (response.status === 204) {
        return undefined as T;
      }

      if (response.status === 401 && attempt === 0) {
        logger.info("Access token expired, refreshing...");
        try {
          this.tokens = await refreshAccessToken(this.tokens);
          saveTokens(this.tokens);
          continue;
        } catch {
          throw new AuthenticationError(
            "Failed to refresh access token. Please re-authorize with: node dist/index.js auth"
          );
        }
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : 1000 * 2 ** attempt;
        if (attempt < this.maxRetries - 1) {
          logger.warn(`Rate limited, waiting ${waitMs}ms before retry...`);
          await this.sleep(waitMs);
          continue;
        }
        throw new RateLimitError(waitMs);
      }

      if (response.status >= 500 && attempt < this.maxRetries - 1) {
        const waitMs = 1000 * 2 ** attempt;
        logger.warn(
          `Server error ${response.status}, retrying in ${waitMs}ms...`
        );
        await this.sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = (await response.json()) as T;

      if (method === "GET" && cacheTtlMs) {
        this.cache.set(cacheKey, data, cacheTtlMs);
      }

      return data;
    }

    throw lastError || new Error("Request failed after retries");
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    let graphError: GraphErrorResponse | undefined;
    try {
      graphError = (await response.json()) as GraphErrorResponse;
    } catch {
      // response body wasn't JSON
    }

    const code = graphError?.error?.code || "";
    const message =
      graphError?.error?.message || `HTTP ${response.status}`;

    if (response.status === 401) {
      throw new AuthenticationError(message);
    }

    if (response.status === 403) {
      throw new InsufficientPermissionsError(message);
    }

    if (response.status === 404) {
      throw new NotFoundError(message);
    }

    throw new GraphApiError(message, response.status, code ? [{ message, code }] : undefined);
  }

  private async ensureValidToken(): Promise<void> {
    const bufferMs = 60_000;
    if (Date.now() >= this.tokens.expires_at - bufferMs) {
      logger.info("Token expiring soon, refreshing proactively...");
      this.tokens = await refreshAccessToken(this.tokens);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  rawBody?: BodyInit;
  contentType?: string;
  params?: Record<string, string | number | undefined>;
  cacheTtlMs?: number;
}
