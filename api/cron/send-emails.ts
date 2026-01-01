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
import { wrapInBaseTemplate } from "../../utils/email/templates/base";
import { generateReportTemplate } from "../../utils/email/templates/report";
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

    // Determine what to send based on query param and settings
    const type = req.query.type as string;

    let sendDaily = false;
    let sendWeekly = false;
    let sendMonthly = false;

    if (type) {
      sendDaily = type === "daily-reminders" && settingsData.daily_reminders;
      sendWeekly = type === "weekly-reports" && settingsData.weekly_reports;
      sendMonthly = type === "monthly-reports" && settingsData.monthly_reports;
    } else {
      // Automatic detection for the single cron job
      // We run this daily, so we always check for daily reminders
      sendDaily = !!settingsData.daily_reminders;

      // Weekly reports on Sunday (0)
      sendWeekly = !!settingsData.weekly_reports && now.getDay() === 0;

      // Monthly reports on the last day of the month
      sendMonthly =
        !!settingsData.monthly_reports &&
        now.getDate() ===
          new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    }

    if (!sendWeekly && !sendMonthly && !sendDaily) {
      res
        .status(200)
        .json(
          createSuccessResponse(
            `Nothing to send for type: ${
              type || "none"
            } (Settings: Daily=${!!settingsData.daily_reminders}, Weekly=${!!settingsData.weekly_reports}, Monthly=${!!settingsData.monthly_reports})`,
          ),
        );
      return;
    }

    const results = [];

    if (sendDaily) {
      const today = new Date().toISOString().split("T")[0];
      const { data: todayEntry } = await supabase
        .from("entry")
        .select("id")
        .eq("date", today)
        .maybeSingle();

      if (!todayEntry) {
        const html = wrapInBaseTemplate(
          `
          <div class="card">
            <h2>Don't forget your check-in!</h2>
            <p>You haven't recorded your mood for today yet. Taking a moment to reflect on your day can help you stay mindful and track your progress.</p>
          </div>
          `,
          "Daily Reminder",
          "Time for your daily check-in",
          "You're receiving this because you have daily reminders enabled in your Moodly settings.",
        );
        await sendEmail(
          settingsData.email,
          "Moodly: Daily Check-in Reminder",
          html,
        );
        results.push("Daily reminder email sent");
      } else {
        results.push("Daily check-in already completed");
      }
    }

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
        const html = generateReportTemplate(
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
        const html = generateReportTemplate(
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
