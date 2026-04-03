import type { AlertCondition, MetricValue, EmailAlert, DailyEntry, MetricConfig } from "../types";
import { wrapInBaseTemplate } from "./email/templates/base";
import { sendEmail } from "./email";

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
