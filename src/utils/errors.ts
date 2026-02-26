export class GraphApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errors?: Array<{ message: string; code?: string }>
  ) {
    super(message);
    this.name = "GraphApiError";
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class RateLimitError extends Error {
  public retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(`Rate limited. Retry after ${retryAfterMs}ms`);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class InsufficientPermissionsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientPermissionsError";
  }
}

export function formatError(error: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  let message: string;

  if (error instanceof AuthenticationError) {
    message = `Authentication Error: ${error.message}\n\nPlease re-authorize by running: node dist/index.js auth`;
  } else if (error instanceof InsufficientPermissionsError) {
    message = `Insufficient Permissions: ${error.message}`;
  } else if (error instanceof NotFoundError) {
    message = `Not Found: ${error.message}`;
  } else if (error instanceof RateLimitError) {
    message = `Rate Limited: ${error.message}`;
  } else if (error instanceof GraphApiError) {
    message = `Graph API Error (${error.statusCode}): ${error.message}`;
    if (error.errors?.length) {
      message += "\n" + error.errors.map((e) => `  - ${e.message}`).join("\n");
    }
  } else if (error instanceof ConfigurationError) {
    message = `Configuration Error: ${error.message}`;
  } else if (error instanceof Error) {
    message = `Error: ${error.message}`;
  } else {
    message = `Error: ${String(error)}`;
  }

  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}
