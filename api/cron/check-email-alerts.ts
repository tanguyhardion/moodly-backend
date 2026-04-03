import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  validateMasterPassword,
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
} from "../../utils/auth";
import { getSupabaseClient } from "../../utils/database";
import { mapDatabaseAlertToEmailAlert, mapDatabaseEntryToDailyEntry } from "../../utils/helpers";
import { evaluateAlert, checkAndSendAlertsForEntry } from "../../utils/alertEvaluator";
import type { EmailAlert, MetricConfig } from "../../types";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (handleOptionsRequest(req, res)) {
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json(createErrorResponse("Method not allowed"));
    return;
  }

  try {
    // Validate authentication: check for cron secret (Vercel cron invocation) or master password (manual run)
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    const isCronInvocation =
      authHeader && cronSecret && authHeader === `Bearer ${cronSecret}`;
    const isManualRun = validateMasterPassword(req);

    if (!isCronInvocation && !isManualRun) {
      res
        .status(401)
        .json(createErrorResponse("Invalid or missing authentication"));
      return;
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
      res.status(500).json(createErrorResponse("Failed to fetch settings"));
      return;
    }

    if (!settingsData || !settingsData.email) {
      res.status(200).json(createSuccessResponse("No email configured"));
      return;
    }

    // 2. Get enabled email alerts
    const { data: alertsData, error: alertsError } = await supabase
      .from("email_alerts")
      .select("*")
      .eq("enabled", true);

    if (alertsError) {
      console.error("Alerts error:", alertsError);
      res.status(500).json(createErrorResponse("Failed to fetch email alerts"));
      return;
    }

    if (!alertsData || alertsData.length === 0) {
      res.status(200).json(createSuccessResponse("No enabled email alerts"));
      return;
    }

    const alerts = alertsData.map(mapDatabaseAlertToEmailAlert);

    // 3. Get today's entry
    const today = new Date().toISOString().split("T")[0];
    const { data: entryData, error: entryError } = await supabase
      .from("daily_entry")
      .select("*")
      .eq("date", today)
      .maybeSingle();

    if (entryError) {
      console.error("Entry error:", entryError);
      res.status(500).json(createErrorResponse("Failed to fetch today's entry"));
      return;
    }

    if (!entryData) {
      res.status(200).json(createSuccessResponse("No entry for today, skipping alert check"));
      return;
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

    res.status(200).json(createSuccessResponse({ results }));
  } catch (error: any) {
    console.error("Error checking email alerts:", error);
    res
      .status(500)
      .json(
        createErrorResponse(
          error.message || "Internal server error while checking email alerts"
        )
      );
  }
}
