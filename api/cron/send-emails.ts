import { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseClient } from "../../utils/database";
import { sendEmail } from "../../utils/email";
import { generateEmailTemplate } from "../../utils/email-template";
import { mapDatabaseEntryToDailyEntry } from "../../utils/helpers";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("[DEBUG_EMAIL] Cron handler started");
  try {
    const supabase = getSupabaseClient();

    // 1. Get Settings
    console.log("[DEBUG_EMAIL] Fetching app settings...");
    const { data: settingsData, error: settingsError } = await supabase
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (settingsError) {
      console.error("[DEBUG_EMAIL] Error fetching settings:", settingsError);
      return res.status(500).json({ error: "Failed to fetch settings" });
    }

    if (!settingsData || !settingsData.email) {
      console.log("[DEBUG_EMAIL] No email configured in settings");
      return res.status(200).json({ message: "No email configured" });
    }

    console.log(`[DEBUG_EMAIL] Settings found. Email: ${settingsData.email}, Weekly: ${settingsData.weekly_updates}, Monthly: ${settingsData.monthly_updates}`);

    const now = new Date();

    // Determine what to send
    let sendWeekly = false;
    let sendMonthly = false;

    // Check if triggered manually via query param
    const type = req.query.type as string;
    console.log(`[DEBUG_EMAIL] Request type query param: ${type}`);
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

    console.log(`[DEBUG_EMAIL] Decision - sendWeekly: ${sendWeekly}, sendMonthly: ${sendMonthly}`);

    if (!sendWeekly && !sendMonthly) {
      return res.status(200).json({ message: "Nothing to send today" });
    }

    const results = [];

    if (sendWeekly) {
      // Get last 7 days
      const endDate = new Date(now);
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);

      console.log(`[DEBUG_EMAIL] Fetching entries for weekly report: ${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}`);

      const { data: entries } = await supabase
        .from("entry")
        .select("*")
        .gte("date", startDate.toISOString().split("T")[0])
        .lte("date", endDate.toISOString().split("T")[0]);

      console.log(`[DEBUG_EMAIL] Found ${entries?.length || 0} entries for weekly report`);

      if (entries && entries.length > 0) {
        const formattedEntries = entries.map(mapDatabaseEntryToDailyEntry);
        const html = generateEmailTemplate(
          "Weekly",
          formattedEntries,
          startDate.toLocaleDateString(),
          endDate.toLocaleDateString(),
        );
        console.log("[DEBUG_EMAIL] Calling sendEmail for weekly report...");
        await sendEmail(settingsData.email, "Your Weekly Moodly Recap", html);
        results.push("Weekly email sent");
      }
    }

    if (sendMonthly) {
      // Get last month
      const endDate = new Date(now);
      const startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 1);

      console.log(`[DEBUG_EMAIL] Fetching entries for monthly report: ${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}`);

      const { data: entries } = await supabase
        .from("entry")
        .select("*")
        .gte("date", startDate.toISOString().split("T")[0])
        .lte("date", endDate.toISOString().split("T")[0]);

      console.log(`[DEBUG_EMAIL] Found ${entries?.length || 0} entries for monthly report`);

      if (entries && entries.length > 0) {
        const formattedEntries = entries.map(mapDatabaseEntryToDailyEntry);
        const html = generateEmailTemplate(
          "Monthly",
          formattedEntries,
          startDate.toLocaleDateString(),
          endDate.toLocaleDateString(),
        );
        console.log("[DEBUG_EMAIL] Calling sendEmail for monthly report...");
        await sendEmail(settingsData.email, "Your Monthly Moodly Recap", html);
        results.push("Monthly email sent");
      }
    }

    console.log(`[DEBUG_EMAIL] Cron job finished. Results: ${results.join(", ")}`);
    res.status(200).json({ results });
  } catch (error: any) {
    console.error("[DEBUG_EMAIL] Cron error:", error);
    res.status(500).json({ error: error.message });
  }
}
