import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  validateMasterPassword,
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
} from "../utils/auth";
import { getSupabaseClient } from "../utils/database";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (handleOptionsRequest(req, res)) {
    return;
  }

  // Validate master password for both GET and POST
  if (!validateMasterPassword(req)) {
    res.status(401).json(createErrorResponse("Invalid master password"));
    return;
  }

  const supabase = getSupabaseClient();

  if (req.method === "GET") {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("id", 1)
        .single();

      if (error && error.code !== "PGRST116") { // PGRST116 is "The result contains 0 rows"
        throw error;
      }

      const settings = data || {
        email: "",
        weekly_updates: false,
        monthly_updates: false,
      };

      res.status(200).json(
        createSuccessResponse({
          email: settings.email,
          weeklyUpdates: settings.weekly_updates,
          monthlyUpdates: settings.monthly_updates,
        })
      );
    } catch (error: any) {
      console.error("Error fetching settings:", error);
      res.status(500).json(createErrorResponse("Failed to fetch settings"));
    }
  } else if (req.method === "POST") {
    try {
      const { email, weeklyUpdates, monthlyUpdates } = req.body;

      const { error } = await supabase.from("app_settings").upsert({
        id: 1,
        email,
        weekly_updates: weeklyUpdates,
        monthly_updates: monthlyUpdates,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      res.status(200).json(createSuccessResponse({ success: true }));
    } catch (error: any) {
      console.error("Error saving settings:", error);
      res.status(500).json(createErrorResponse("Failed to save settings"));
    }
  } else {
    res.status(405).json(createErrorResponse("Method not allowed"));
  }
}
