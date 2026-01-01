export interface DailyEntry {
  id: string;
  date: string;
  metrics: {
    mood: number | null;
    energy: number | null;
    sleep: number | null;
    focus: number | null;
    stress: number | null;
  };
  checkboxes: {
    [key: string]: boolean;
  };
  location?: {
    name: string;
    latitude: number;
    longitude: number;
  } | null;
  note?: string | null;
  createdAt?: string;
}

export interface Insight {
  type: string;
  label: string;
  text: string;
  score: number;
  details?: string;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastEntryDate: string | null;
}

export interface AppSettings {
  email: string;
  dailyReminders: boolean;
  weeklyReports: boolean;
  monthlyReports: boolean;
}
