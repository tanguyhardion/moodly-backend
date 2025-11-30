import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Supabase client instance
let supabaseClient: SupabaseClient | null = null;

/**
 * Initialize or get the Supabase client
 * @returns Supabase client instance
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "Missing required environment variables: SUPABASE_URL and SUPABASE_KEY"
      );
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }

  return supabaseClient;
}

/**
 * Generic function to read data from any table
 * @param tableName - Name of the table to read from
 * @param columns - Columns to select (default: '*')
 * @returns Promise with the data or error
 */
export async function readFromTable<T = any>(
  tableName: string,
  columns: string = "*"
) {
  try {
    const client = getSupabaseClient();
    const query = client.from(tableName).select(columns);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Database read error: ${error.message}`);
    }

    return { data, error: null };
  } catch (error) {
    console.error(`Error reading from table ${tableName}:`, error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Export the client for direct access if needed
export { supabaseClient };
