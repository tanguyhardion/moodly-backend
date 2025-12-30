import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  validateMasterPassword,
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
} from "../../utils/auth";
import { getSupabaseClient } from "../../utils/database";
import { sendEmail } from "../../utils/email";
import { generateEmailTemplate } from "../../utils/email-template";
import { mapDatabaseEntryToDailyEntry } from "../../utils/helpers";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  setCorsHeaders(res);

  if (handleOptionsRequest(req, res)) {
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json(createErrorResponse("Method not allowed"));
    return;
  }

  try {
    // Validate master password
    if (!validateMasterPassword(req)) {
      res
        .status(401)
        .json(createErrorResponse("Invalid or missing master password"));
      return;
    }

    const supabase = getSupabaseClient();

    // 1. Get Settings
    const { data: settingsData, error: settingsError } = await supabase
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (settingsError) {
      console.error("Settings error:", settingsError);
      res.status(500).json(createErrorResponse("Failed to fetch settings"));
      return;
    }

    if (!settingsData || !settingsData.email) {
      res.status(200).json(createSuccessResponse("No email configured"));
      return;
    }

    const now = new Date();

    // Determine what to send
    let sendWeekly = false;
    let sendMonthly = false;

    // Check if triggered manually via query param
    const type = (req.query.type) as string;
    if (type === "weekly") sendWeekly = true;
    if (type === "monthly") sendMonthly = true;

    if (!type) {
      // Weekly: Send on Sundays (scheduled via cron)
      if (settingsData.weekly_updates) {
        sendWeekly = true;
      }
      // Monthly: Send on last day of month (scheduled via cron)
      if (settingsData.monthly_updates) {
        sendMonthly = true;
      }
    }

    if (!sendWeekly && !sendMonthly) {
      res.status(200).json(createSuccessResponse("Nothing to send today"));
      return;
    }

    const results = [];

    if (sendWeekly) {
      // Get last 7 days
      const endDate = new Date(now);
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);

      const { data: entries } = await supabase
        .from("entry")
        .select("*")
        .gte("date", startDate.toISOString().split("T")[0])
        .lte("date", endDate.toISOString().split("T")[0]);

      if (entries && entries.length > 0) {
        const formattedEntries = entries.map(mapDatabaseEntryToDailyEntry);
        const html = generateEmailTemplate(
          "Weekly",
          formattedEntries,
          startDate.toLocaleDateString(),
          endDate.toLocaleDateString(),
        );
        await sendEmail(settingsData.email, "Your Weekly Moodly Recap", html);
        results.push("Weekly email sent");
      }
    }

    if (sendMonthly) {
      // Get last month
      const endDate = new Date(now);
      const startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 1);

      const { data: entries } = await supabase
        .from("entry")
        .select("*")
        .gte("date", startDate.toISOString().split("T")[0])
        .lte("date", endDate.toISOString().split("T")[0]);

      if (entries && entries.length > 0) {
        const formattedEntries = entries.map(mapDatabaseEntryToDailyEntry);
        const html = generateEmailTemplate(
          "Monthly",
          formattedEntries,
          startDate.toLocaleDateString(),
          endDate.toLocaleDateString(),
        );
        await sendEmail(settingsData.email, "Your Monthly Moodly Recap", html);
        results.push("Monthly email sent");
      }
    }

    res.status(200).json(createSuccessResponse({ results }));
  } catch (error: any) {
    console.error("Error sending emails:", error);
    res
      .status(500)
      .json(
        createErrorResponse(
          error.message || "Internal server error while sending emails",
        ),
      );
  }
}
