import { VercelRequest } from "@vercel/node";

export function validateMasterPassword(req: VercelRequest): boolean {
  const masterPassword = process.env.MASTER_PASSWORD;

  if (!masterPassword) {
    console.error("MASTER_PASSWORD environment variable not set");
    return false;
  }

  // Check query parameter first, then body
  const providedPassword = req.query.masterPassword || req.body?.masterPassword;

  return providedPassword === masterPassword;
}

export function setCorsHeaders(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function handleOptionsRequest(req: VercelRequest, res: any) {
  if (req.method === "OPTIONS") {
    setCorsHeaders(res);
    res.status(200).end();
    return true;
  }
  return false;
}

export function createErrorResponse(message: string, statusCode: number = 400) {
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
