import { withApi, createErrorResponse, createSuccessResponse } from "../utils/api";
import { getSettings, getSupabaseClient } from "../utils/database";
import { mapAppSettingsToDatabaseSettings } from "../utils/helpers";
import type { AppSettings } from "../types";

const DEFAULT_SETTINGS: AppSettings = {
  email: "",
  dailyReminders: false,
  weeklyReports: false,
  monthlyReports: false,
};

export default withApi({ methods: ["GET", "POST"] }, async (req, res) => {
  if (req.method === "GET") {
    try {
      const settings = await getSettings();
      return res.status(200).json(createSuccessResponse(settings ?? DEFAULT_SETTINGS));
    } catch (error) {
      console.error("Error fetching settings:", error);
      return res.status(500).json(createErrorResponse("Failed to fetch settings"));
    }
  }

  const dbSettings = {
    ...mapAppSettingsToDatabaseSettings(req.body),
    id: 1,
    updated_at: new Date().toISOString(),
  };

  const { error } = await getSupabaseClient().from("app_settings").upsert(dbSettings);

  if (error) {
    console.error("Error saving settings:", error);
    return res.status(500).json(createErrorResponse("Failed to save settings"));
  }

  return res.status(200).json(createSuccessResponse({ success: true }));
});
