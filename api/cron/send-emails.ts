import { withApi, createSuccessResponse } from "../../utils/api";
import { getEntries, getEntryByDate, getMetricConfigs, getSettings, getSupabaseClient } from "../../utils/database";
import { sendEmail } from "../../utils/email";
import { wrapInBaseTemplate } from "../../utils/email/templates/base";
import { generateReportTemplate } from "../../utils/email/templates/report";
import { getLocalDateString } from "../../utils/helpers";

/**
 * Sends every scheduled letter that is due and not yet sent. Uses `send_date <= today`
 * so a letter missed by a failed or skipped run goes out on the next one.
 */
async function sendDueLetters(email: string): Promise<string[]> {
  const supabase = getSupabaseClient();
  const results: string[] = [];

  const { data: dueLetters, error: lettersError } = await supabase
    .from("scheduled_letter")
    .select("*")
    .lte("send_date", getLocalDateString(new Date()))
    .eq("sent", false);

  if (lettersError) {
    console.error("Error fetching scheduled letters:", lettersError);
    return ["Failed to fetch scheduled letters"];
  }

  for (const letter of dueLetters ?? []) {
    try {
      const createdDate = new Date(letter.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const html = wrapInBaseTemplate(
        `
        <div class="card">
          <h2>A Letter from Your Past Self</h2>
          <p style="font-size: 12px; color: #6f6878; margin-bottom: 16px;">
            Written on ${createdDate}
          </p>
          <p style="white-space: pre-wrap; line-height: 1.8;">${letter.message}</p>
        </div>
        `,
        "Letter to Future Self",
        "You wrote this letter to yourself...",
        "You scheduled this letter to be delivered today."
      );

      await sendEmail(email, "Moodly: A Letter from Your Past Self", html);

      const { error: markError } = await supabase
        .from("scheduled_letter")
        .update({ sent: true })
        .eq("id", letter.id);

      if (markError) {
        // The email went out, but the next run will send it again until this succeeds.
        console.error(`Letter ${letter.id} sent but not marked as sent:`, markError);
        results.push(`Letter ${letter.id} sent, but failed to mark as sent`);
      } else {
        results.push(`Letter ${letter.id} sent successfully`);
      }
    } catch (letterError) {
      console.error(`Error sending letter ${letter.id}:`, letterError);
      results.push(`Letter ${letter.id} failed to send`);
    }
  }

  return results;
}

export default withApi({ methods: ["GET"], auth: "session-or-cron" }, async (req, res) => {
  const settings = await getSettings();

  if (!settings?.email) {
    return res.status(200).json(createSuccessResponse("No email configured"));
  }

  // Letters are independent of the report settings, so they go out on every run.
  const results = await sendDueLetters(settings.email);

  const now = new Date();

  // Determine what to send based on query param and settings
  const type = req.query.type as string;

  let sendDaily = false;
  let sendWeekly = false;
  let sendMonthly = false;

  if (type) {
    sendDaily = type === "daily-reminders" && settings.dailyReminders;
    sendWeekly = type === "weekly-reports" && settings.weeklyReports;
    sendMonthly = type === "monthly-reports" && settings.monthlyReports;
  } else {
    // Automatic detection for the single cron job
    // We run this daily, so we always check for daily reminders
    sendDaily = settings.dailyReminders;

    // Weekly reports on Sunday (0)
    sendWeekly = settings.weeklyReports && now.getDay() === 0;

    // Monthly reports on the last day of the month
    sendMonthly =
      settings.monthlyReports &&
      now.getDate() ===
        new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  }

  if (!sendWeekly && !sendMonthly && !sendDaily) {
    results.push(
      `No reports to send for type: ${
        type || "none"
      } (Settings: Daily=${settings.dailyReminders}, Weekly=${settings.weeklyReports}, Monthly=${settings.monthlyReports})`
    );
    return res.status(200).json(createSuccessResponse({ results }));
  }

  if (sendDaily) {
    const todayEntry = await getEntryByDate(getLocalDateString(new Date()));

    if (!todayEntry) {
      const html = wrapInBaseTemplate(
        `
        <div class="card">
          <h2>Don't forget your check-in!</h2>
          <p>You haven't recorded your mood today yet. Taking a moment to reflect on your day can help you stay mindful and track your progress.</p>
        </div>
        `,
        "Daily Reminder",
        "Time for your daily check-in",
        "You're receiving this because you have daily reminders enabled in your Moodly settings."
      );
      await sendEmail(
        settings.email,
        "Moodly: Daily Check-in Reminder",
        html
      );
      results.push("Daily reminder email sent");
    } else {
      results.push("Daily check-in already completed");
    }
  }

  if (sendWeekly || sendMonthly) {
    // Fetch metric config once for report generation
    const metrics = await getMetricConfigs();

    if (sendWeekly) {
      const endDate = new Date(now);
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);

      const entries = await getEntries({
        from: getLocalDateString(startDate),
        to: getLocalDateString(endDate),
      });

      if (entries.length > 0) {
        const html = generateReportTemplate(
          "Weekly",
          entries,
          metrics,
          startDate.toLocaleDateString(),
          endDate.toLocaleDateString()
        );
        await sendEmail(settings.email, "Your Weekly Moodly Recap", html);
        results.push("Weekly email sent");
      }
    }

    if (sendMonthly) {
      const endDate = new Date(now);
      const startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 1);

      const entries = await getEntries({
        from: getLocalDateString(startDate),
        to: getLocalDateString(endDate),
      });

      if (entries.length > 0) {
        const html = generateReportTemplate(
          "Monthly",
          entries,
          metrics,
          startDate.toLocaleDateString(),
          endDate.toLocaleDateString()
        );
        await sendEmail(settings.email, "Your Monthly Moodly Recap", html);
        results.push("Monthly email sent");
      }
    }
  }

  return res.status(200).json(createSuccessResponse({ results }));
});
