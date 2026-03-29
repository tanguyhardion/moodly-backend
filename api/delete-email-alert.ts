import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  validateMasterPassword,
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
} from "../utils/auth";
import { getSupabaseClient } from "../utils/database";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (handleOptionsRequest(req, res)) {
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json(createErrorResponse("Method not allowed"));
    return;
  }

  if (!validateMasterPassword(req)) {
    res.status(401).json(createErrorResponse("Invalid master password"));
    return;
  }

  try {
    const supabase = getSupabaseClient();
    const { id } = req.body;

    if (!id) {
      res.status(400).json(createErrorResponse("Missing required field: id"));
      return;
    }

    const { error } = await supabase
      .from("email_alerts")
      .delete()
      .eq("id", id);

    if (error) throw error;

    res.status(200).json(createSuccessResponse({ id }));
  } catch (error: any) {
    console.error("Error deleting email alert:", error);
    res.status(500).json(createErrorResponse("Failed to delete email alert"));
  }
}
