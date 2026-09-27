import { withApi, createErrorResponse, createSuccessResponse } from "../utils/api";
import { getSupabaseClient } from "../utils/database";
import { mapDatabaseAlertToEmailAlert, mapEmailAlertToDatabaseRow } from "../utils/helpers";
import type { EmailAlert } from "../types";

export default withApi({ methods: ["GET", "POST", "DELETE"] }, async (req, res) => {
  const supabase = getSupabaseClient();

  // GET - Fetch email alerts
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("email_alerts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json(createSuccessResponse((data || []).map(mapDatabaseAlertToEmailAlert)));
  }

  // POST - Save email alert
  if (req.method === "POST") {
    const alert = req.body as EmailAlert;

    if (!alert.name || !alert.emailSubject || !alert.emailMessage) {
      return res.status(400).json(createErrorResponse("Missing required fields"));
    }

    if (!alert.conditions || alert.conditions.length === 0) {
      return res.status(400).json(createErrorResponse("At least one condition is required"));
    }

    const dbRow = mapEmailAlertToDatabaseRow(alert);

    const { data, error } = alert.id
      ? await supabase.from("email_alerts").update(dbRow).eq("id", alert.id).select().single()
      : await supabase.from("email_alerts").insert(dbRow).select().single();

    if (error) throw error;

    return res.status(200).json(createSuccessResponse(mapDatabaseAlertToEmailAlert(data)));
  }

  // DELETE - Delete email alert
  const { id } = req.body;

  if (!id) {
    return res.status(400).json(createErrorResponse("Missing required field: id"));
  }

  const { error } = await supabase.from("email_alerts").delete().eq("id", id);

  if (error) throw error;

  return res.status(200).json(createSuccessResponse({ id }));
});
