import type { DailyEntry, AppSettings, MetricConfig, UserMetricConfiguration } from "../../types";

// --- Database <-> App Mapping: Daily Entries ---

export function mapDatabaseEntryToDailyEntry(row: Record<string, unknown>): DailyEntry {
  return {
    id: row.id as string,
    date: row.date as string,
    data: (row.data as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string | undefined,
  };
}

export function mapDailyEntryToDatabaseRow(entry: DailyEntry): Record<string, unknown> {
  return {
    id: entry.id,
    date: entry.date,
    data: entry.data,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt ?? new Date().toISOString(),
  };
}

// --- Database <-> App Mapping: Metric Configuration ---

export function mapDatabaseConfigToUserConfig(row: Record<string, unknown>): UserMetricConfiguration {
  return {
    id: row.id as number,
    metrics: (row.metrics as MetricConfig[]) ?? [],
    updatedAt: row.updated_at as string | undefined,
  };
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

// --- Utility Helpers ---

export function formatHabit(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .toLowerCase()
    .replace(/^./, (str) => str.toUpperCase());
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastEntryDate: string | null;
}

export function calculateStreak(dates: string[]): StreakData {
  if (dates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastEntryDate: null };
  }

  const sortedDates = [...dates].sort((a, b) => b.localeCompare(a));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const latestDate = sortedDates[0];
  const isStreakActive = latestDate === todayStr || latestDate === yesterdayStr;

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  if (isStreakActive) {
    let expectedDate = new Date(today);
    if (latestDate === yesterdayStr) {
      expectedDate = yesterday;
    }

    for (const dateStr of sortedDates) {
      const expectedStr = expectedDate.toISOString().split("T")[0];
      if (dateStr === expectedStr) {
        currentStreak++;
        expectedDate.setDate(expectedDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  let expectedDate = new Date(sortedDates[0]);
  expectedDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < sortedDates.length; i++) {
    const dateStr = sortedDates[i];
    const entryDate = new Date(dateStr);
    entryDate.setHours(0, 0, 0, 0);
    const expectedStr = expectedDate.toISOString().split("T")[0];

    if (dateStr === expectedStr) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else {
      tempStreak = 1;
      expectedDate = new Date(entryDate);
      expectedDate.setDate(expectedDate.getDate() - 1);
    }
  }

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    lastEntryDate: sortedDates[0],
  };
}
