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

// --- Email Alerts ---
export type AlertOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'is_true' | 'is_false';

export interface AlertCondition {
  metricId: string;
  operator: AlertOperator;
  value: number | string | boolean | null;
}

export interface EmailAlert {
  id?: number;
  name: string;
  enabled: boolean;
  conditions: AlertCondition[];
  conditionLogic: 'all' | 'any';
  emailSubject: string;
  emailMessage: string;
  createdAt?: string;
  updatedAt?: string;
}

// --- API Response ---
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
