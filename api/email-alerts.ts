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

  if (!validateMasterPassword(req)) {
    res.status(401).json(createErrorResponse("Invalid master password"));
    return;
  }

  try {
    const supabase = getSupabaseClient();

    // GET - Fetch email alerts
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("email_alerts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const alerts = (data || []).map(mapDatabaseAlertToEmailAlert);

      res.status(200).json(createSuccessResponse(alerts));
      return;
    }

    // POST - Save email alert
    if (req.method === "POST") {
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
        const { data, error } = await supabase
          .from("email_alerts")
          .update(dbRow)
          .eq("id", alert.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase
          .from("email_alerts")
          .insert(dbRow)
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      res.status(200).json(createSuccessResponse(mapDatabaseAlertToEmailAlert(result)));
      return;
    }

    // DELETE - Delete email alert
    if (req.method === "DELETE") {
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
      return;
    }

    res.status(405).json(createErrorResponse("Method not allowed"));
  } catch (error: any) {
    console.error("Error handling email alerts request:", error);
    res.status(500).json(createErrorResponse("Failed to process email alert request"));
  }
}
