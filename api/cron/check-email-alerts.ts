import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  validateMasterPassword,
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
} from "../../utils/auth";
import { getSupabaseClient } from "../../utils/database";
import { sendEmail } from "../../utils/email";
import { wrapInBaseTemplate } from "../../utils/email/templates/base";
import { mapDatabaseAlertToEmailAlert, mapDatabaseEntryToDailyEntry } from "../../utils/helpers";
import type { AlertCondition, MetricValue, EmailAlert, DailyEntry, MetricConfig } from "../../types";

function evaluateCondition(
  condition: AlertCondition,
  entryData: Record<string, MetricValue>,
  metrics: MetricConfig[]
): boolean {
  const value = entryData[condition.metricId];
  const metric = metrics.find((m) => m.id === condition.metricId);

  // Handle null/undefined values
  if (value === null || value === undefined) {
    // Only is_false can match null for checkboxes
    if (condition.operator === "is_false" && metric?.type === "checkbox") {
      return true;
    }
    return false;
  }

  switch (condition.operator) {
    case "eq":
      return value === condition.value;
    case "neq":
      return value !== condition.value;
    case "gt":
      return typeof value === "number" && value > (condition.value as number);
    case "gte":
      return typeof value === "number" && value >= (condition.value as number);
    case "lt":
      return typeof value === "number" && value < (condition.value as number);
    case "lte":
      return typeof value === "number" && value <= (condition.value as number);
    case "is_true":
      return value === true;
    case "is_false":
      return value === false;
    default:
      return false;
  }
}

function evaluateAlert(
  alert: EmailAlert,
  entryData: Record<string, MetricValue>,
  metrics: MetricConfig[]
): boolean {
  if (alert.conditionLogic === "all") {
    return alert.conditions.every((c) => evaluateCondition(c, entryData, metrics));
  } else {
    return alert.conditions.some((c) => evaluateCondition(c, entryData, metrics));
  }
}

function formatAlertEmail(
  alert: EmailAlert,
  entry: DailyEntry,
  metrics: MetricConfig[]
): string {
  // Replace placeholders in the message
  let message = alert.emailMessage;

  // Replace {{metric_name}} placeholders with actual values
  for (const metric of metrics) {
    const value = entry.data[metric.id];
    let displayValue = "N/A";

    if (value !== null && value !== undefined) {
      if (typeof value === "boolean") {
        displayValue = value ? "Yes" : "No";
      } else if (typeof value === "object" && "name" in value) {
        displayValue = value.name;
      } else {
        displayValue = String(value);
      }
    }

    // Replace both {{metric.id}} and {{metric.label}} patterns
    message = message.replace(new RegExp(`\\{\\{${metric.id}\\}\\}`, "gi"), displayValue);
    message = message.replace(new RegExp(`\\{\\{${metric.label}\\}\\}`, "gi"), displayValue);
  }

  // Build triggered conditions summary
  const triggeredConditions = alert.conditions.map((c) => {
    const metric = metrics.find((m) => m.id === c.metricId);
    const metricLabel = metric?.label ?? c.metricId;
    const value = entry.data[c.metricId];
    let displayValue = "N/A";

    if (value !== null && value !== undefined) {
      if (typeof value === "boolean") {
        displayValue = value ? "Yes" : "No";
      } else if (typeof value === "object" && "name" in value) {
        displayValue = value.name;
      } else {
        displayValue = String(value);
      }
    }

    return `<li><strong>${metricLabel}:</strong> ${displayValue}</li>`;
  }).join("");

  return wrapInBaseTemplate(
    `
    <div class="card">
      <h2>${alert.name}</h2>
      <p style="white-space: pre-wrap; line-height: 1.8;">${message}</p>
    </div>
    <div class="card">
      <h2>Triggered Values</h2>
      <ul style="margin: 0; padding-left: 20px;">
        ${triggeredConditions}
      </ul>
      <p style="font-size: 12px; color: #6b7280; margin-top: 16px;">
        Entry date: ${entry.date}
      </p>
    </div>
    `,
    "Alert Triggered",
    alert.emailSubject,
    "You're receiving this because you set up an email alert in your Moodly settings."
  );
}

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
    const results: string[] = [];

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

    // 5. Evaluate each alert and send emails for those that match
    for (const alert of alerts) {
      try {
        const shouldTrigger = evaluateAlert(alert, entry.data, metrics);

        if (shouldTrigger) {
          const html = formatAlertEmail(alert, entry, metrics);
          await sendEmail(settingsData.email, alert.emailSubject, html);
          results.push(`Alert "${alert.name}" triggered and email sent`);
        } else {
          results.push(`Alert "${alert.name}" did not trigger`);
        }
      } catch (alertError) {
        console.error(`Error processing alert ${alert.id}:`, alertError);
        results.push(`Alert "${alert.name}" failed to process`);
      }
    }

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
