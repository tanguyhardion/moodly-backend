import type { AlertCondition, MetricValue, EmailAlert, DailyEntry, MetricConfig } from "../types";
import { wrapInBaseTemplate } from "./email/templates/base";
import { sendEmail } from "./email";
import { formatMetricValue } from "./helpers";
import { getEnabledAlerts, getEntryByDate, getMetricConfigs, getSettings } from "./database";

export function evaluateCondition(
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

export function evaluateAlert(
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

export function formatAlertEmail(
  alert: EmailAlert,
  entry: DailyEntry,
  metrics: MetricConfig[]
): string {
  // Replace {{metric id}} and {{metric label}} placeholders (case-insensitive) with the entry's values.
  // Looked up by key rather than built into a RegExp, so labels like "C++" or "Sleep (h)" are safe.
  const valuesByPlaceholder = new Map<string, string>();
  for (const metric of metrics) {
    const displayValue = formatMetricValue(entry.data[metric.id]);
    valuesByPlaceholder.set(metric.id.toLowerCase(), displayValue);
    valuesByPlaceholder.set(metric.label.trim().toLowerCase(), displayValue);
  }

  const message = alert.emailMessage.replace(
    /\{\{([^{}]+)\}\}/g,
    (placeholder, key: string) => valuesByPlaceholder.get(key.trim().toLowerCase()) ?? placeholder,
  );

  // Build triggered conditions summary
  const triggeredConditions = alert.conditions.map((c) => {
    const metric = metrics.find((m) => m.id === c.metricId);
    const metricLabel = metric?.label ?? c.metricId;
    return `<li><strong>${metricLabel}:</strong> ${formatMetricValue(entry.data[c.metricId])}</li>`;
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

export async function checkAndSendAlertsForEntry(
  email: string,
  entry: DailyEntry,
  alerts: EmailAlert[],
  metrics: MetricConfig[]
): Promise<string[]> {
  const results: string[] = [];

  for (const alert of alerts) {
    try {
      const shouldTrigger = evaluateAlert(alert, entry.data, metrics);

      if (shouldTrigger) {
        const html = formatAlertEmail(alert, entry, metrics);
        await sendEmail(email, alert.emailSubject, html);
        results.push(`Alert "${alert.name}" triggered and email sent`);
      } else {
        results.push(`Alert "${alert.name}" did not trigger`);
      }
    } catch (alertError) {
      console.error(`Error processing alert ${alert.id}:`, alertError);
      results.push(`Alert "${alert.name}" failed to process`);
    }
  }

  return results;
}

/** Loads settings, enabled alerts, the entry for `date` and metric config, then evaluates and sends alerts. */
export async function runAlertsForDate(date: string): Promise<string[]> {
  const settings = await getSettings();
  if (!settings?.email) return ["No email configured"];

  const alerts = await getEnabledAlerts();
  if (alerts.length === 0) return ["No enabled email alerts"];

  const entry = await getEntryByDate(date);
  if (!entry) return [`No entry found for ${date}`];

  const metrics = await getMetricConfigs();
  return checkAndSendAlertsForEntry(settings.email, entry, alerts, metrics);
}
