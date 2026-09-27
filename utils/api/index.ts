import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isAuthorizedCronRequest, isAuthorizedSessionRequest } from "../auth";

type HttpMethod = "GET" | "POST" | "DELETE";

interface ApiHandlerOptions {
  methods: HttpMethod[];
  /**
   * - "session": requires a valid session token (the default)
   * - "session-or-cron": also accepts Vercel's CRON_SECRET bearer token
   * - "none": public endpoint
   */
  auth?: "session" | "session-or-cron" | "none";
}

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>;

export function createErrorResponse(message: string) {
  return {
    success: false,
    error: message,
  };
}

export function createSuccessResponse<T>(data: T) {
  return {
    success: true,
    data,
  };
}

function setCorsHeaders(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function isAuthorized(req: VercelRequest, auth: ApiHandlerOptions["auth"]): boolean {
  if (auth === "none") return true;
  if (auth === "session-or-cron" && isAuthorizedCronRequest(req)) return true;
  return isAuthorizedSessionRequest(req);
}

/**
 * Wraps an endpoint with the shared CORS, preflight, method, auth and error handling,
 * so the handler only contains the endpoint's own logic.
 */
export function withApi(options: ApiHandlerOptions, handler: ApiHandler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    if (!options.methods.includes(req.method as HttpMethod)) {
      res.status(405).json(createErrorResponse("Method not allowed"));
      return;
    }

    try {
      if (!isAuthorized(req, options.auth ?? "session")) {
        res.status(401).json(createErrorResponse("Invalid or missing authentication"));
        return;
      }

      await handler(req, res);
    } catch (error) {
      console.error(`Error handling ${req.method} ${req.url}:`, error);
      if (!res.headersSent) {
        res.status(500).json(createErrorResponse("Internal server error"));
      }
    }
  };
}
