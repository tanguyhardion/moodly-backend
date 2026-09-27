import type { DailyEntry, AppSettings, MetricDataMap, MetricValue, EmailAlert, AlertCondition } from "../../types";

// --- Database <-> App Mapping: Daily Entries ---

export function mapDatabaseEntryToDailyEntry(row: Record<string, unknown>): DailyEntry {
  return {
    id: row.id as string,
    date: row.date as string,
    data: (row.data as MetricDataMap) ?? {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string | undefined,
  };
}

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// --- Database <-> App Mapping: Settings ---

export function mapDatabaseSettingsToAppSettings(settings: Record<string, unknown>): AppSettings {
  return {
    email: (settings.email as string) || "",
    dailyReminders: (settings.daily_reminders as boolean) || false,
    weeklyReports: (settings.weekly_reports as boolean) || false,
    monthlyReports: (settings.monthly_reports as boolean) || false,
  };
}

export function mapAppSettingsToDatabaseSettings(settings: AppSettings): Record<string, unknown> {
  return {
    email: settings.email,
    daily_reminders: settings.dailyReminders,
    weekly_reports: settings.weeklyReports,
    monthly_reports: settings.monthlyReports,
  };
}

// --- Display Formatting ---

/** Human-readable metric value for emails: "Yes"/"No", location name, or "N/A" when empty. */
export function formatMetricValue(value: MetricValue | undefined): string {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return value.name;
  return String(value);
}

// --- Database <-> App Mapping: Email Alerts ---

export function mapDatabaseAlertToEmailAlert(row: Record<string, unknown>): EmailAlert {
  return {
    id: row.id as number,
    name: row.name as string,
    enabled: row.enabled as boolean,
    conditions: row.conditions as AlertCondition[],
    conditionLogic: row.condition_logic as 'all' | 'any',
    emailSubject: row.email_subject as string,
    emailMessage: row.email_message as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string | undefined,
  };
}

export function mapEmailAlertToDatabaseRow(alert: EmailAlert): Record<string, unknown> {
  return {
    ...(alert.id ? { id: alert.id } : {}),
    name: alert.name,
    enabled: alert.enabled,
    conditions: alert.conditions,
    condition_logic: alert.conditionLogic,
    email_subject: alert.emailSubject,
    email_message: alert.emailMessage,
    updated_at: new Date().toISOString(),
  };
}
