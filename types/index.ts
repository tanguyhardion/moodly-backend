export interface DailyEntry {
  id: string;
  date: string;
  metrics: {
    mood: number;
    energy: number;
    sleep: number;
    focus: number;
  };
  checkboxes: {
    [key: string]: boolean;
  };
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
  weeklyUpdates: boolean;
  monthlyUpdates: boolean;
}
