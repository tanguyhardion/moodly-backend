import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  validateMasterPassword,
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
} from "../utils/auth";
import { getSupabaseClient } from "../utils/database";
import { mapDatabaseAlertToEmailAlert, mapEmailAlertToDatabaseRow } from "../utils/helpers";
import type { EmailAlert } from "../types";

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
    const alert = req.body as EmailAlert;

    if (!alert.name || !alert.emailSubject || !alert.emailMessage) {
      res.status(400).json(createErrorResponse("Missing required fields"));
      return;
    }

    if (!alert.conditions || alert.conditions.length === 0) {
      res.status(400).json(createErrorResponse("At least one condition is required"));
      return;
    }

    const dbRow = mapEmailAlertToDatabaseRow(alert);

    let result;
    if (alert.id) {
      // Update existing alert
      const { data, error } = await supabase
        .from("email_alerts")
        .update(dbRow)
        .eq("id", alert.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new alert
      const { data, error } = await supabase
        .from("email_alerts")
        .insert(dbRow)
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    res.status(200).json(createSuccessResponse(mapDatabaseAlertToEmailAlert(result)));
  } catch (error: any) {
    console.error("Error saving email alert:", error);
    res.status(500).json(createErrorResponse("Failed to save email alert"));
  }
}
