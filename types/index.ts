// ============================================
// Moodly Backend - Type Definitions
// ============================================

// --- Metric Types (mirrors frontend) ---
export type MetricType = 'slider' | 'checkbox' | 'number' | 'time' | 'location' | 'text';

export interface MetricConfig {
  id: string;
  type: MetricType;
  label: string;
  icon?: string;
  color?: string;
  order: number;
  group?: string;
  // Slider
  min?: number;
  max?: number;
  step?: number;
  labels?: [string, string];
  // Number
  unit?: string;
  // Text
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
}

export type MetricValue = number | boolean | string | { name: string; latitude: number; longitude: number } | null;
export type MetricDataMap = Record<string, MetricValue>;

// --- Daily Entry ---
export interface DailyEntry {
  id: string;
  date: string;
  data: MetricDataMap;
  createdAt: string;
  updatedAt?: string;
}

// --- User Metric Configuration ---
export interface UserMetricConfiguration {
  id?: number;
  metrics: MetricConfig[];
  updatedAt?: string;
}

// --- App Settings ---
export interface AppSettings {
  email: string;
  dailyReminders: boolean;
  weeklyReports: boolean;
  monthlyReports: boolean;
}

// --- API Response ---
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
