import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  validateMasterPassword,
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
} from "../utils/auth";
import { getSupabaseClient } from "../utils/database";
import * as ss from "simple-statistics";

interface MoodEntry {
  id: string;
  date: string;
  metrics: {
    mood: number;
    energy: number;
    sleep: number;
    focus: number;
  };
  checkboxes: {
    [key: string]: boolean;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (handleOptionsRequest(req, res)) {
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json(createErrorResponse("Method not allowed"));
    return;
  }

  try {
    if (!validateMasterPassword(req)) {
      res
        .status(401)
        .json(createErrorResponse("Invalid or missing master password"));
      return;
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("entry")
      .select("*")
      .order("date", { ascending: true }); // Ascending for time-series analysis

    if (error) {
      console.error("Supabase error:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to fetch entries from database"));
      return;
    }

    const entries: MoodEntry[] = data.map((entry: any) => ({
      id: entry.id,
      date: entry.date,
      metrics: {
        mood: entry.mood,
        energy: entry.energy,
        sleep: entry.sleep,
        focus: entry.focus,
      },
      checkboxes: {
        healthyFood: entry.healthy_food,
        caffeine: entry.caffeine,
        gym: entry.gym,
        hardWork: entry.hard_work,
        dayOff: entry.day_off,
        alcohol: entry.alcohol,
        misc: entry.misc,
      },
    }));

    if (entries.length < 5) {
      res.status(200).json(
        createSuccessResponse({
          insights: [],
          message: "Not enough data for analytics (need at least 5 entries)",
        })
      );
      return;
    }

    const insights = generateInsights(entries);

    res.status(200).json(createSuccessResponse({ insights }));
  } catch (error: any) {
    console.error("Analytics error:", error);
    res.status(500).json(createErrorResponse(error.message));
  }
}

function generateInsights(entries: MoodEntry[]) {
  const insights: any[] = [];
  const metrics = ["mood", "energy", "sleep", "focus"];
  const checkboxes = Array.from(
    new Set(entries.flatMap((e) => Object.keys(e.checkboxes)))
  );

  // 1. Correlation Insights (Mood vs Habits)
  checkboxes.forEach((habit) => {
    const habitValues = entries.map((e) => (e.checkboxes[habit] ? 1 : 0));
    const moodValues = entries.map((e) => e.metrics.mood);

    // Only calculate if we have variation
    if (ss.standardDeviation(habitValues) > 0 && ss.standardDeviation(moodValues) > 0) {
      const correlation = ss.sampleCorrelation(habitValues, moodValues);
      if (Math.abs(correlation) > 0.3) {
        const direction = correlation > 0 ? "improves" : "worsens";
        insights.push({
          type: "correlation",
          category: "Habit Impact",
          text: `Your mood tends to ${direction} when you ${formatHabit(habit)}.`,
          score: Math.abs(correlation),
          details: `Correlation: ${correlation.toFixed(2)}`,
        });
      }
    }
  });

  // 2. Comparative Insights (Average Mood with vs without habit)
  checkboxes.forEach((habit) => {
    const withHabit = entries.filter((e) => e.checkboxes[habit]);
    const withoutHabit = entries.filter((e) => !e.checkboxes[habit]);

    if (withHabit.length > 0 && withoutHabit.length > 0) {
      const avgWith = ss.mean(withHabit.map((e) => e.metrics.mood));
      const avgWithout = ss.mean(withoutHabit.map((e) => e.metrics.mood));
      const diff = avgWith - avgWithout;

      if (Math.abs(diff) > 0.5) {
        const better = diff > 0 ? "better" : "worse";
        insights.push({
          type: "comparative",
          category: "Comparison",
          text: `You feel ${better} on days with ${formatHabit(habit)} (average of ${avgWith.toFixed(1)} on those days vs ${avgWithout.toFixed(1)} otherwise).`,
          score: Math.abs(diff),
        });
      }
    }
  });

  // 3. Pattern Insights (Day of Week)
  const daysOfWeek = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const dayMoods: { [key: number]: number[] } = {};

  entries.forEach((entry) => {
    const day = new Date(entry.date).getDay();
    if (!dayMoods[day]) dayMoods[day] = [];
    dayMoods[day].push(entry.metrics.mood);
  });

  let bestDay = -1;
  let maxAvg = -1;

  Object.keys(dayMoods).forEach((dayStr) => {
    const day = parseInt(dayStr);
    const avg = ss.mean(dayMoods[day]);
    if (avg > maxAvg) {
      maxAvg = avg;
      bestDay = day;
    }
  });

  if (bestDay !== -1) {
    insights.push({
      type: "pattern",
      category: "Weekly Trend",
      text: `Your mood peaks on ${daysOfWeek[bestDay]}s (Average: ${maxAvg.toFixed(1)}).`,
      score: 0.8, // Static score for now
    });
  }

  // 4. Trigger Insights (Precursors - Lag 1)
  // Check if yesterday's low sleep affects today's mood
  const sleepValues = entries.slice(0, -1).map(e => e.metrics.sleep);
  const nextDayMoodValues = entries.slice(1).map(e => e.metrics.mood);
  
  if (sleepValues.length > 0 && ss.standardDeviation(sleepValues) > 0 && ss.standardDeviation(nextDayMoodValues) > 0) {
      const sleepLagCorrelation = ss.sampleCorrelation(sleepValues, nextDayMoodValues);
      if (sleepLagCorrelation > 0.3) {
           insights.push({
              type: "trigger",
              category: "Precursor",
              text: "Good sleep often leads to better mood the next day.",
              score: sleepLagCorrelation
           });
      } else if (sleepLagCorrelation < -0.3) {
           // Rare, but maybe "Too much sleep makes me groggy?"
      }
  }


  // Sort by score/relevance
  return insights.sort((a, b) => b.score - a.score);
}

function formatHabit(key: string): string {
  // Convert camelCase to readable text
  return key
    .replace(/([A-Z])/g, " $1")
    .toLowerCase()
    .replace(/^./, (str) => str.toUpperCase());
}
