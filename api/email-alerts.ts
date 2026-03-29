import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  validateMasterPassword,
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
} from "../utils/auth";
import { getSupabaseClient } from "../utils/database";
import { mapDatabaseAlertToEmailAlert } from "../utils/helpers";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (handleOptionsRequest(req, res)) {
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json(createErrorResponse("Method not allowed"));
    return;
  }

  if (!validateMasterPassword(req)) {
    res.status(401).json(createErrorResponse("Invalid master password"));
    return;
  }

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("email_alerts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const alerts = (data || []).map(mapDatabaseAlertToEmailAlert);

    res.status(200).json(createSuccessResponse(alerts));
  } catch (error: any) {
    console.error("Error fetching email alerts:", error);
    res.status(500).json(createErrorResponse("Failed to fetch email alerts"));
  }
}
