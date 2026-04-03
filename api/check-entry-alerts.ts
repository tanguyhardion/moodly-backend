import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  validateMasterPassword,
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
} from "../utils/auth";
import { getSupabaseClient } from "../utils/database";
import { mapDatabaseAlertToEmailAlert, mapDatabaseEntryToDailyEntry } from "../utils/helpers";
import { checkAndSendAlertsForEntry } from "../utils/alertEvaluator";
import type { EmailAlert, MetricConfig } from "../types";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (handleOptionsRequest(req, res)) {
    return;
  }

  if (!validateMasterPassword(req)) {
    return res.status(401).json(createErrorResponse("Invalid or missing master password"));
  }

  if (req.method !== "POST") {
    return res.status(405).json(createErrorResponse("Method not allowed"));
  }

  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json(createErrorResponse("Date is required"));
    }

    const supabase = getSupabaseClient();

    // 1. Get user settings for email address
    const { data: settingsData, error: settingsError } = await supabase
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (settingsError) {
      console.error("Settings error:", settingsError);
      return res.status(500).json(createErrorResponse("Failed to fetch settings"));
    }

    if (!settingsData || !settingsData.email) {
      return res.status(200).json(createSuccessResponse({ results: ["No email configured"] }));
    }

    // 2. Get enabled email alerts
    const { data: alertsData, error: alertsError } = await supabase
      .from("email_alerts")
      .select("*")
      .eq("enabled", true);

    if (alertsError) {
      console.error("Alerts error:", alertsError);
      return res.status(500).json(createErrorResponse("Failed to fetch email alerts"));
    }

    if (!alertsData || alertsData.length === 0) {
      return res.status(200).json(createSuccessResponse({ results: ["No enabled email alerts"] }));
    }

    const alerts: EmailAlert[] = alertsData.map(mapDatabaseAlertToEmailAlert);

    // 3. Get entry for the specified date
    const { data: entryData, error: entryError } = await supabase
      .from("daily_entry")
      .select("*")
      .eq("date", date)
      .maybeSingle();

    if (entryError) {
      console.error("Entry error:", entryError);
      return res.status(500).json(createErrorResponse("Failed to fetch entry"));
    }

    if (!entryData) {
      return res.status(200).json(createSuccessResponse({ results: ["No entry found for specified date"] }));
    }

    const entry = mapDatabaseEntryToDailyEntry(entryData);

    // 4. Get metric config for labels
    const { data: metricConfigData } = await supabase
      .from("metric_config")
      .select("metrics")
      .eq("id", 1)
      .single();

    const metrics: MetricConfig[] = metricConfigData?.metrics ?? [];

    // 5. Check and send alerts
    const results = await checkAndSendAlertsForEntry(
      settingsData.email,
      entry,
      alerts,
      metrics
    );

    return res.status(200).json(createSuccessResponse({ results }));
  } catch (error) {
    console.error("Error handling check entry alerts request:", error);
    return res.status(500).json(createErrorResponse("Internal server error"));
  }
}
