import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { AppSettings, DailyEntry, EmailAlert, MetricConfig } from "../../types";
import {
  mapDatabaseAlertToEmailAlert,
  mapDatabaseEntryToDailyEntry,
  mapDatabaseSettingsToAppSettings,
} from "../helpers";

// Supabase client instance
let supabaseClient: SupabaseClient | null = null;

/**
 * Initialize or get the Supabase client.
 * SUPABASE_KEY must be the service-role (secret) key: RLS is enabled on every table
 * with no policies, so only the service role can read or write.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "Missing required environment variables: SUPABASE_URL and SUPABASE_KEY",
      );
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return supabaseClient;
}

// --- Shared queries ---

/** Returns null when no settings row exists yet. */
export async function getSettings(): Promise<AppSettings | null> {
  const { data, error } = await getSupabaseClient()
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapDatabaseSettingsToAppSettings(data) : null;
}

export async function getMetricConfigRow(): Promise<{ metrics: MetricConfig[]; updatedAt: string | null }> {
  const { data, error } = await getSupabaseClient()
    .from("metric_config")
    .select("metrics, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  return { metrics: data?.metrics ?? [], updatedAt: data?.updated_at ?? null };
}

export async function getMetricConfigs(): Promise<MetricConfig[]> {
  return (await getMetricConfigRow()).metrics;
}

export async function getEnabledAlerts(): Promise<EmailAlert[]> {
  const { data, error } = await getSupabaseClient()
    .from("email_alerts")
    .select("*")
    .eq("enabled", true);

  if (error) throw error;
  return (data ?? []).map(mapDatabaseAlertToEmailAlert);
}

export async function getEntryByDate(date: string): Promise<DailyEntry | null> {
  const { data, error } = await getSupabaseClient()
    .from("daily_entry")
    .select("*")
    .eq("date", date)
    .maybeSingle();

  if (error) throw error;
  return data ? mapDatabaseEntryToDailyEntry(data) : null;
}

/**
 * Fetches entries newest first, paging past PostgREST's max-rows cap (1000 by default).
 * Advances by the number of rows actually returned and stops on an empty page,
 * so it stays correct whatever the server's cap is.
 */
export async function getEntries(filter: { from?: string; to?: string } = {}): Promise<DailyEntry[]> {
  const PAGE_SIZE = 1000;
  const rows: Record<string, unknown>[] = [];

  for (let offset = 0; ; ) {
    let query = getSupabaseClient()
      .from("daily_entry")
      .select("*")
      .order("date", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (filter.from) query = query.gte("date", filter.from);
    if (filter.to) query = query.lte("date", filter.to);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...data);
    offset += data.length;
  }

  return rows.map(mapDatabaseEntryToDailyEntry);
}
