// ============================================
// Moodly - Shared Domain Types
//
// This file is duplicated byte-for-byte in:
//   moodly-frontend/app/types/shared.ts
//   moodly-backend/types/shared.ts
// Edit one, copy it to the other, and run `npm run check:types` in moodly-backend.
// Keep it dependency-free: types only, no runtime code.
// ============================================

// --- Metric Type Identifiers ---
export type MetricType = 'slider' | 'checkbox' | 'number' | 'time' | 'location' | 'text' | 'calculated';

// --- Base Metric Configuration ---
interface MetricConfigBase {
  /** Unique identifier for this metric */
  id: string;
  /** The metric type discriminant */
  type: MetricType;
  /** Display label */
  label: string;
  /** Icon name (Iconify format, e.g. "solar:heart-bold") */
  icon?: string;
  /** Theme color for this metric */
  color?: string;
  /** Display order index */
  order: number;
  /** Group name for visual grouping on the dashboard */
  group?: string;
}

// --- Discriminated Union: Metric Configurations ---

export interface SliderMetricConfig extends MetricConfigBase {
  type: 'slider';
  min: number;
  max: number;
  step: number;
  /** Labels for min and max ends, e.g. ["Terrible", "Amazing"] */
  labels?: [string, string];
}

export interface CheckboxMetricConfig extends MetricConfigBase {
  type: 'checkbox';
}

export interface NumberMetricConfig extends MetricConfigBase {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
}

export interface TimeMetricConfig extends MetricConfigBase {
  type: 'time';
  /** Placeholder text, e.g. "HH:MM" */
  placeholder?: string;
}

export interface LocationMetricConfig extends MetricConfigBase {
  type: 'location';
  placeholder?: string;
  /** Enable automatic weather fetching when location is selected */
  enableWeather?: boolean;
}

export interface TextMetricConfig extends MetricConfigBase {
  type: 'text';
  placeholder?: string;
  /** Maximum character length */
  maxLength?: number;
  /** Whether to render as a multi-line textarea */
  multiline?: boolean;
}

// --- Calculated Metric Formula Types ---

export interface TimeDiffFormula {
  formulaType: 'time_diff';
  /** ID of the "from" time metric (e.g. bedtime) */
  fromMetricId: string;
  /** ID of the "to" time metric (e.g. wake-up) */
  toMetricId: string;
  unit: 'hours' | 'minutes';
}

/** Discriminated union of all formula types — extensible for future operations */
export type CalculatedFormula = TimeDiffFormula;

export interface CalculatedMetricConfig extends MetricConfigBase {
  type: 'calculated';
  formula: CalculatedFormula;
}

/** Union of all metric configurations */
export type MetricConfig =
  | SliderMetricConfig
  | CheckboxMetricConfig
  | NumberMetricConfig
  | TimeMetricConfig
  | LocationMetricConfig
  | TextMetricConfig
  | CalculatedMetricConfig;

// --- Metric Value Types ---

export interface WeatherData {
  /** Average temperature in Celsius */
  temperature: number | null;
  /** Max temperature in Celsius */
  temperatureMax?: number | null;
  /** Min temperature in Celsius */
  temperatureMin?: number | null;
  /** Weather condition string (e.g., "Sunny", "Rainy") */
  condition: string;
  /** WMO weather code */
  conditionCode: number;
  /** Icon identifier (sunny, cloudy, rainy, snowy, stormy, foggy, etc.) */
  icon: string;
  /** Relative humidity percentage */
  humidity?: number | null;
  /** Precipitation in mm */
  precipitation?: number;
  /** Wind speed in km/h */
  windSpeed?: number | null;
}

export interface LocationValue {
  name: string;
  latitude: number;
  longitude: number;
  /** Weather data at the time of entry (if weather tracking enabled) */
  weather?: WeatherData;
}

/** All possible metric values */
export type MetricValue = number | boolean | string | LocationValue | null;

/** Type-safe map of metric id -> value */
export type MetricDataMap = Record<string, MetricValue>;

// --- Daily Entry ---

export interface DailyEntry {
  id: string;
  date: string; // YYYY-MM-DD
  data: MetricDataMap;
  createdAt: string;
  updatedAt?: string;
}

// --- User's Metric Configuration (persisted) ---

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
  theme?: 'light' | 'dark' | 'system';
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

// --- API Response Types ---

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// --- Scheduled Letters ---

export interface ScheduledLetter {
  id: number;
  message: string;
  sendDate: string; // YYYY-MM-DD
  createdAt: string;
}

// --- Auth ---

export interface SessionToken {
  token: string;
  expiresAt: string;
}
