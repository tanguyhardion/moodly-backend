import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  validateMasterPassword,
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
} from "../utils/auth";
import { getSupabaseClient } from "../utils/database";
import { formatHabit, getHabitAction } from "../utils/helpers";
import * as ss from "simple-statistics";
import { DailyEntry, Insight } from "../types";

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

    const entries: DailyEntry[] = data.map((entry: any) => ({
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
        }),
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

function generateInsights(entries: DailyEntry[]): Insight[] {
  const insights: Insight[] = [];
  const metrics = ["mood", "energy", "sleep", "focus"];
  const checkboxes = Array.from(
    new Set(entries.flatMap((e) => Object.keys(e.checkboxes))),
  );

  // 1. Metric vs Habit Correlations (Inter metric-habit)
  metrics.forEach((metric) => {
    checkboxes.forEach((habit) => {
      const habitValues = entries.map((e) => (e.checkboxes[habit] ? 1 : 0));
      const metricValues = entries.map(
        (e) => e.metrics[metric as keyof typeof e.metrics],
      );

      // Only calculate if we have variation
      if (
        ss.standardDeviation(habitValues) > 0 &&
        ss.standardDeviation(metricValues) > 0
      ) {
        const correlation = ss.sampleCorrelation(habitValues, metricValues);
        if (Math.abs(correlation) > 0.3) {
          const direction = correlation > 0 ? "improves" : "worsens";
          const text =
            metric === "mood"
              ? `Your mood tends to ${direction} when you ${getHabitAction(
                  habit,
                )}.`
              : `Your ${metric} tends to be ${
                  correlation > 0 ? "higher" : "lower"
                } when you ${getHabitAction(habit)}.`;

          insights.push({
            type: "habit-impact",
            label: "Habit Impact",
            text: text,
            score: Math.abs(correlation),
          });
        }
      }
    });
  });

  // 1b. Intra-metric Correlations
  for (let i = 0; i < metrics.length; i++) {
    for (let j = i + 1; j < metrics.length; j++) {
      const m1 = metrics[i];
      const m2 = metrics[j];

      const v1 = entries.map((e) => e.metrics[m1 as keyof typeof e.metrics]);
      const v2 = entries.map((e) => e.metrics[m2 as keyof typeof e.metrics]);

      if (ss.standardDeviation(v1) > 0 && ss.standardDeviation(v2) > 0) {
        const correlation = ss.sampleCorrelation(v1, v2);
        if (Math.abs(correlation) > 0.4) {
          const relationship = correlation > 0 ? "positive" : "negative";
          insights.push({
            type: "metric-connection",
            label: "Metric Connection",
            text: `There is a strong ${relationship} link between your ${m1} and ${m2}.`,
            score: Math.abs(correlation),
          });
        }
      }
    }
  }

  // 1c. Intra-habit Correlations
  for (let i = 0; i < checkboxes.length; i++) {
    for (let j = i + 1; j < checkboxes.length; j++) {
      const h1 = checkboxes[i];
      const h2 = checkboxes[j];

      const v1 = entries.map((e) => (e.checkboxes[h1] ? 1 : 0));
      const v2 = entries.map((e) => (e.checkboxes[h2] ? 1 : 0));

      if (ss.standardDeviation(v1) > 0 && ss.standardDeviation(v2) > 0) {
        const correlation = ss.sampleCorrelation(v1, v2);
        if (Math.abs(correlation) > 0.4) {
          const relationship =
            correlation > 0
              ? "often happen together"
              : "rarely happen together";
          insights.push({
            type: "habit-pattern",
            label: "Habit Pattern",
            text: `${formatHabit(h1)} and ${formatHabit(h2)} ${relationship}.`,
            score: Math.abs(correlation),
          });
        }
      }
    }
  }

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
          type: "habit-comparison",
          label: "Comparison",
          text: `You feel ${better} on days with ${formatHabit(
            habit,
          )} (average of ${avgWith.toFixed(
            1,
          )} on those days vs ${avgWithout.toFixed(1)} otherwise).`,
          score: Math.abs(diff),
          details: `Difference: ${diff > 0 ? "+" : ""}${diff.toFixed(1)} mood points`,
        });
      }
    }
  });

  // 3. Pattern Insights (Day of Week) - For all metrics
  const daysOfWeek = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  metrics.forEach((metric) => {
    const dayValues: { [key: number]: number[] } = {};

    entries.forEach((entry) => {
      const day = new Date(entry.date).getDay();
      if (!dayValues[day]) dayValues[day] = [];
      dayValues[day].push(entry.metrics[metric as keyof typeof entry.metrics]);
    });

    let bestDay = -1;
    let maxAvg = -1;

    Object.keys(dayValues).forEach((dayStr) => {
      const day = parseInt(dayStr);
      const avg = ss.mean(dayValues[day]);
      if (avg > maxAvg) {
        maxAvg = avg;
        bestDay = day;
      }
    });

    if (bestDay !== -1) {
      insights.push({
        type: "weekly-trend",
        label: "Weekly Trend",
        text: `Your ${metric} peaks on ${
          daysOfWeek[bestDay]
        }s (Average: ${maxAvg.toFixed(1)}).`,
        score: 0.8,
        details: `Based on ${dayValues[bestDay].length} entries`,
      });
    }
  });

  // 4. Trigger Insights (Precursors - Lag 1)
  // Check if yesterday's low sleep affects today's mood
  const sleepValues = entries.slice(0, -1).map((e) => e.metrics.sleep);
  const nextDayMoodValues = entries.slice(1).map((e) => e.metrics.mood);

  if (
    sleepValues.length > 0 &&
    ss.standardDeviation(sleepValues) > 0 &&
    ss.standardDeviation(nextDayMoodValues) > 0
  ) {
    const sleepLagCorrelation = ss.sampleCorrelation(
      sleepValues,
      nextDayMoodValues,
    );
    if (sleepLagCorrelation > 0.3) {
      insights.push({
        type: "trigger",
        label: "Precursor",
        text: "Good sleep often leads to better mood the next day.",
        score: sleepLagCorrelation,
        details: `Correlation: ${sleepLagCorrelation.toFixed(2)}`,
      });
    } else if (sleepLagCorrelation < -0.3) {
      insights.push({
        type: "trigger",
        label: "Precursor",
        text: "Surprisingly, more sleep tends to be followed by lower mood the next day.",
        score: Math.abs(sleepLagCorrelation),
        details: `Correlation: ${sleepLagCorrelation.toFixed(2)}`,
      });
    }
  }

  // 5. Metric Deterioration Trends
  if (entries.length >= 10) {
    const midpoint = Math.floor(entries.length / 2);
    const firstHalf = entries.slice(0, midpoint);
    const secondHalf = entries.slice(midpoint);

    metrics.forEach((metric) => {
      const firstAvg = ss.mean(
        firstHalf.map((e) => e.metrics[metric as keyof typeof e.metrics]),
      );
      const secondAvg = ss.mean(
        secondHalf.map((e) => e.metrics[metric as keyof typeof e.metrics]),
      );
      const decline = firstAvg - secondAvg;

      if (decline > 1) {
        insights.push({
          type: "long-term-trend",
          label: "Warning",
          text: `Your ${metric} has declined recently (${firstAvg.toFixed(
            1,
          )} → ${secondAvg.toFixed(1)}).`,
          score: decline,
          details: `Change: -${decline.toFixed(1)} points`,
        });
      } else if (decline < -1) {
        insights.push({
          type: "long-term-trend",
          label: "Improvement",
          text: `Your ${metric} is improving over time (${firstAvg.toFixed(
            1,
          )} → ${secondAvg.toFixed(1)}).`,
          score: Math.abs(decline),
          details: `Change: +${Math.abs(decline).toFixed(1)} points`,
        });
      }
    });
  }

  // 6. Optimal Habit Combinations (Synergy Detection)
  for (let i = 0; i < checkboxes.length; i++) {
    for (let j = i + 1; j < checkboxes.length; j++) {
      const habit1 = checkboxes[i];
      const habit2 = checkboxes[j];

      const bothHabits = entries.filter(
        (e) => e.checkboxes[habit1] && e.checkboxes[habit2],
      );
      const onlyHabit1 = entries.filter(
        (e) => e.checkboxes[habit1] && !e.checkboxes[habit2],
      );
      const onlyHabit2 = entries.filter(
        (e) => !e.checkboxes[habit1] && e.checkboxes[habit2],
      );
      const neitherHabit = entries.filter(
        (e) => !e.checkboxes[habit1] && !e.checkboxes[habit2],
      );

      // Need enough data for each combination
      if (
        bothHabits.length >= 2 &&
        onlyHabit1.length >= 2 &&
        onlyHabit2.length >= 2
      ) {
        const bothAvg = ss.mean(bothHabits.map((e) => e.metrics.mood));
        const habit1Avg = ss.mean(onlyHabit1.map((e) => e.metrics.mood));
        const habit2Avg = ss.mean(onlyHabit2.map((e) => e.metrics.mood));
        const neitherAvg =
          neitherHabit.length > 0
            ? ss.mean(neitherHabit.map((e) => e.metrics.mood))
            : 0;

        // Calculate expected mood if habits were independent
        const expectedCombined = Math.max(habit1Avg, habit2Avg);
        const synergy = bothAvg - expectedCombined;

        // If the combination is significantly better than either alone
        if (synergy > 0.7) {
          insights.push({
            type: "synergy",
            label: "Habit Synergy",
            text: `${formatHabit(habit1)} + ${formatHabit(
              habit2,
            )} together boost your mood more than either alone (${bothAvg.toFixed(
              1,
            )} vs ${habit1Avg.toFixed(1)} and ${habit2Avg.toFixed(1)}).`,
            score: synergy,
            details: `Synergy Bonus: +${synergy.toFixed(1)} points`,
          });
        }
      }
    }
  }

  // Sort by score/relevance
  return insights.sort((a, b) => b.score - a.score);
}
