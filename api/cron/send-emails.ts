import { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseClient } from "../../utils/database";
import { sendEmail } from "../../utils/email";
import { generateEmailTemplate } from "../../utils/email-template";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient();

    // 1. Get Settings
    const { data: settingsData, error: settingsError } = await supabase
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (settingsError) {
      console.error("Error fetching settings:", settingsError);
      return res.status(500).json({ error: "Failed to fetch settings" });
    }

    if (!settingsData || !settingsData.email) {
      return res.status(200).json({ message: "No email configured" });
    }

    const now = new Date();
    
    // Determine what to send
    let sendWeekly = false;
    let sendMonthly = false;

    // Check if triggered manually via query param
    const type = req.query.type as string;
    if (type === 'weekly') sendWeekly = true;
    if (type === 'monthly') sendMonthly = true;

    // Or check dates (assuming this runs daily)
    if (!type) {
      // Weekly: Send on Monday
      if (now.getDay() === 1 && settingsData.weekly_updates) { // 1 = Monday
         sendWeekly = true;
      }
      // Monthly: Send on 1st
      if (now.getDate() === 1 && settingsData.monthly_updates) {
         sendMonthly = true;
      }
    }

    if (!sendWeekly && !sendMonthly) {
      return res.status(200).json({ message: "Nothing to send today" });
    }

    const results = [];

    if (sendWeekly) {
      // Get last 7 days
      const endDate = new Date(now);
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);

      const { data: entries } = await supabase
        .from("entries")
        .select("*")
        .gte("date", startDate.toISOString().split("T")[0])
        .lte("date", endDate.toISOString().split("T")[0]);

      if (entries && entries.length > 0) {
        // Map DB entries to DailyEntry type if needed, but structure usually matches
        // Assuming DB structure matches DailyEntry roughly or is compatible
        const html = generateEmailTemplate("Weekly", entries as any, startDate.toLocaleDateString(), endDate.toLocaleDateString());
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
        .from("entries")
        .select("*")
        .gte("date", startDate.toISOString().split("T")[0])
        .lte("date", endDate.toISOString().split("T")[0]);

      if (entries && entries.length > 0) {
        const html = generateEmailTemplate("Monthly", entries as any, startDate.toLocaleDateString(), endDate.toLocaleDateString());
        await sendEmail(settingsData.email, "Your Monthly Moodly Recap", html);
        results.push("Monthly email sent");
      }
    }

    res.status(200).json({ results });
  } catch (error: any) {
    console.error("Cron error:", error);
    res.status(500).json({ error: error.message });
  }
}
