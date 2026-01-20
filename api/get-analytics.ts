import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  validateMasterPassword,
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
} from "../utils/auth";
import { getSupabaseClient } from "../utils/database";
import {
  formatHabit,
  getHabitAction,
  calculateStreak,
  mapDatabaseEntryToDailyEntry,
} from "../utils/helpers";
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

    const entries: DailyEntry[] = data.map(mapDatabaseEntryToDailyEntry);

    if (entries.length < 5) {
      // Even with little data, calculate streak
      const dates = entries.map((e) => e.date);
      const streakData = calculateStreak(dates);

      res.status(200).json(
        createSuccessResponse({
          insights: [],
          streak: streakData,
          message: "Not enough data for analytics (need at least 5 entries)",
        }),
      );
      return;
    }

    const insights = generateInsights(entries);

    // Calculate streak data
    const dates = entries.map((e) => e.date);
    const streakData = calculateStreak(dates);

    res
      .status(200)
      .json(createSuccessResponse({ insights, streak: streakData }));
  } catch (error: any) {
    console.error("Analytics error:", error);
    res.status(500).json(createErrorResponse(error.message));
  }
}

type MetricKey = keyof DailyEntry["metrics"];
const METRICS: MetricKey[] = ["mood", "energy", "sleep", "focus", "stress"];

/**
 * Extracts values for two metrics only when both exist for the same entry.
 * Essential for accurate correlation calculation.
 */
function getPairedMetricValues(
  entries: DailyEntry[],
  metric1: MetricKey,
  metric2: MetricKey,
): { v1: number[]; v2: number[] } {
  const v1: number[] = [];
  const v2: number[] = [];

  entries.forEach((entry) => {
    const val1 = entry.metrics[metric1];
    const val2 = entry.metrics[metric2];

    if (val1 !== null && val2 !== null) {
      v1.push(val1);
      v2.push(val2);
    }
  });

  return { v1, v2 };
}

/**
 * Extracts values for a metric and a habit (binary 1/0) only when the metric exists.
 */
function getPairedHabitMetricValues(
  entries: DailyEntry[],
  habit: string,
  metric: MetricKey,
): { habitValues: number[]; metricValues: number[] } {
  const habitValues: number[] = [];
  const metricValues: number[] = [];

  entries.forEach((entry) => {
    const metricVal = entry.metrics[metric];

    if (metricVal !== null) {
      metricValues.push(metricVal);
      habitValues.push(entry.checkboxes[habit] ? 1 : 0);
    }
  });

  return { habitValues, metricValues };
}

/**
 * Safe wrapper for simple-statistics mean.
 * Returns null if array is empty or invalid.
 */
function safeMean(values: number[]): number | null {
  if (!values || values.length === 0) return null;
  return ss.mean(values);
}

/**
 * Safe wrapper for simple-statistics standardDeviation.
 * Returns 0 if array has insufficient data.
 */
function safeStdDev(values: number[]): number {
  if (!values || values.length < 2) return 0;
  return ss.standardDeviation(values);
}

/**
 * Safe wrapper for simple-statistics sampleCorrelation.
 */
function safeCorrelation(v1: number[], v2: number[]): number {
  if (
    !v1 ||
    !v2 ||
    v1.length < 2 ||
    v2.length < 2 ||
    v1.length !== v2.length
  ) {
    return 0;
  }

  // Ensure there is variance
  if (safeStdDev(v1) === 0 || safeStdDev(v2) === 0) {
    return 0;
  }

  return ss.sampleCorrelation(v1, v2);
}

function generateInsights(entries: DailyEntry[]): Insight[] {
  const insights: Insight[] = [];
  const checkboxes = Array.from(
    new Set(entries.flatMap((e) => Object.keys(e.checkboxes))),
  );

  // 1. Metric vs Habit Correlations (Inter metric-habit)
  METRICS.forEach((metric) => {
    checkboxes.forEach((habit) => {
      const { habitValues, metricValues } = getPairedHabitMetricValues(
        entries,
        habit,
        metric,
      );

      const correlation = safeCorrelation(habitValues, metricValues);

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
    });
  });

  // 1b. Intra-metric Correlations
  for (let i = 0; i < METRICS.length; i++) {
    for (let j = i + 1; j < METRICS.length; j++) {
      const m1 = METRICS[i];
      const m2 = METRICS[j];

      const { v1, v2 } = getPairedMetricValues(entries, m1, m2);
      const correlation = safeCorrelation(v1, v2);

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

  // 1c. Intra-habit Correlations
  for (let i = 0; i < checkboxes.length; i++) {
    for (let j = i + 1; j < checkboxes.length; j++) {
      const h1 = checkboxes[i];
      const h2 = checkboxes[j];

      // Both habits are effectively non-null booleans, so we can just map directly
      const v1 = entries.map((e) => (e.checkboxes[h1] ? 1 : 0));
      const v2 = entries.map((e) => (e.checkboxes[h2] ? 1 : 0));

      const correlation = safeCorrelation(v1, v2);

      if (Math.abs(correlation) > 0.4) {
        const relationship =
          correlation > 0 ? "often happen together" : "rarely happen together";
        insights.push({
          type: "habit-pattern",
          label: "Habit Pattern",
          text: `${formatHabit(h1)} and ${formatHabit(h2)} ${relationship}.`,
          score: Math.abs(correlation),
        });
      }
    }
  }

  // 2. Comparative Insights (Average Mood with vs without habit)
  checkboxes.forEach((habit) => {
    // Filter entries where mood is not null
    const validEntries = entries.filter((e) => e.metrics.mood !== null);
    
    const withHabit = validEntries.filter((e) => e.checkboxes[habit]);
    const withoutHabit = validEntries.filter((e) => !e.checkboxes[habit]);

    if (withHabit.length > 0 && withoutHabit.length > 0) {
      // We know mood is not null because of the filter above, but TypeScript needs help or we cast
      const moodWith = withHabit.map((e) => e.metrics.mood as number);
      const moodWithout = withoutHabit.map((e) => e.metrics.mood as number);
      
      const avgWith = safeMean(moodWith);
      const avgWithout = safeMean(moodWithout);

      if (avgWith !== null && avgWithout !== null) {
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
            details: `Difference: ${diff > 0 ? "+" : ""}${diff.toFixed(
              1,
            )} mood points`,
          });
        }
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

  METRICS.forEach((metric) => {
    const dayValues: { [key: number]: number[] } = {};

    entries.forEach((entry) => {
      const val = entry.metrics[metric];
      if (val !== null) {
        const day = new Date(entry.date).getDay();
        if (!dayValues[day]) dayValues[day] = [];
        dayValues[day].push(val);
      }
    });

    let bestDay = -1;
    let maxAvg = -1;

    Object.keys(dayValues).forEach((dayStr) => {
      const day = parseInt(dayStr);
      const values = dayValues[day];
      const avg = safeMean(values);
      
      if (avg !== null && avg > maxAvg) {
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
  const sleepValues: number[] = [];
  const nextDayMoodValues: number[] = [];

  for (let i = 0; i < entries.length - 1; i++) {
    const current = entries[i];
    const next = entries[i + 1];
    
    if (current.metrics.sleep !== null && next.metrics.mood !== null) {
      sleepValues.push(current.metrics.sleep);
      nextDayMoodValues.push(next.metrics.mood);
    }
  }

  const sleepLagCorrelation = safeCorrelation(sleepValues, nextDayMoodValues);

  if (Math.abs(sleepLagCorrelation) > 0.3) {
    if (sleepLagCorrelation > 0) {
      insights.push({
        type: "trigger",
        label: "Precursor",
        text: "Good sleep quality often leads to better mood the next day.",
        score: sleepLagCorrelation,
        details: `Correlation: ${sleepLagCorrelation.toFixed(2)}`,
      });
    } else {
      insights.push({
        type: "trigger",
        label: "Precursor",
        text: "Surprisingly, higher sleep quality tends to be followed by lower mood the next day.",
        score: Math.abs(sleepLagCorrelation),
        details: `Correlation: ${sleepLagCorrelation.toFixed(2)}`,
      });
    }
  }

  // Sleep Hours (Duration) Impact on Next Day Metrics
  // We need to build paired arrays for each metric against sleep hours
  const nextDayMetrics: MetricKey[] = ["mood", "energy", "focus", "stress"];

  nextDayMetrics.forEach((metric) => {
    const sleepHourValues: number[] = [];
    const nextDayMetricValues: number[] = [];

    for (let i = 0; i < entries.length - 1; i++) {
      const current = entries[i];
      const next = entries[i + 1];
      
      const sleepH = current.metrics.sleepHours;
      const nextVal = next.metrics[metric];

      if (sleepH !== null && nextVal !== null) {
        sleepHourValues.push(sleepH);
        nextDayMetricValues.push(nextVal);
      }
    }

    const correlation = safeCorrelation(sleepHourValues, nextDayMetricValues);

    if (Math.abs(correlation) > 0.3) {
      const direction = correlation > 0 ? "improves" : "worsens";
      const text =
        metric === "mood"
          ? `Getting more sleep hours tends to ${direction} your mood the next day.`
          : `Sleep duration correlates with your next-day ${metric}.`;

      insights.push({
        type: "trigger",
        label: "Precursor",
        text: text,
        score: Math.abs(correlation),
        details: `Correlation: ${correlation.toFixed(2)}`,
      });
    }
  });

  // Sleep Hours Impact on Habits
  checkboxes.forEach((habit) => {
    const validEntries = entries.filter(e => e.metrics.sleepHours !== null);
    
    // We already filtered for null sleepHours
    const withHabit = validEntries.filter(e => e.checkboxes[habit]).map(e => e.metrics.sleepHours as number);
    const withoutHabit = validEntries.filter(e => !e.checkboxes[habit]).map(e => e.metrics.sleepHours as number);

    if (withHabit.length > 2 && withoutHabit.length > 2) {
      const avgWith = safeMean(withHabit);
      const avgWithout = safeMean(withoutHabit);
      
      if (avgWith !== null && avgWithout !== null) {
        const diff = avgWith - avgWithout;

        if (Math.abs(diff) > 0.5) {
          const moreOrLess = diff > 0 ? "more" : "less";
          insights.push({
            type: "habit-impact",
            label: "Habit Impact",
            text: `You get ${moreOrLess} sleep on days when you ${getHabitAction(
              habit,
            )}.`,
            score: Math.abs(diff),
            details: `Difference: ${Math.abs(diff).toFixed(1)} hours`,
          });
        }
      }
    }
  });

  // 5. Metric Deterioration Trends
  if (entries.length >= 10) {
    const midpoint = Math.floor(entries.length / 2);
    const firstHalf = entries.slice(0, midpoint);
    const secondHalf = entries.slice(midpoint);

    METRICS.forEach((metric) => {
      // Filter nulls for each half
      const v1 = firstHalf.map(e => e.metrics[metric]).filter((v): v is number => v !== null);
      const v2 = secondHalf.map(e => e.metrics[metric]).filter((v): v is number => v !== null);
      
      const firstAvg = safeMean(v1);
      const secondAvg = safeMean(v2);

      if (firstAvg !== null && secondAvg !== null) {
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
      }
    });
  }

  // 6. Optimal Habit Combinations (Synergy Detection)
  for (let i = 0; i < checkboxes.length; i++) {
    for (let j = i + 1; j < checkboxes.length; j++) {
      const habit1 = checkboxes[i];
      const habit2 = checkboxes[j];

      // To simplify, we only care about mood for synergy right now
      // Filter for valid mood first
      const validEntries = entries.filter((e) => e.metrics.mood !== null);

      const bothHabits = validEntries.filter(
        (e) => e.checkboxes[habit1] && e.checkboxes[habit2],
      );
      const onlyHabit1 = validEntries.filter(
        (e) => e.checkboxes[habit1] && !e.checkboxes[habit2],
      );
      const onlyHabit2 = validEntries.filter(
        (e) => !e.checkboxes[habit1] && e.checkboxes[habit2],
      );
      
      if (
        bothHabits.length >= 2 &&
        onlyHabit1.length >= 2 &&
        onlyHabit2.length >= 2
      ) {
        // Safe to cast as number because of initial filter
        const bothAvg = safeMean(bothHabits.map((e) => e.metrics.mood as number));
        const habit1Avg = safeMean(onlyHabit1.map((e) => e.metrics.mood as number));
        const habit2Avg = safeMean(onlyHabit2.map((e) => e.metrics.mood as number));

        if (bothAvg !== null && habit1Avg !== null && habit2Avg !== null) {
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
  }

  // Sort by score/relevance
  return insights.sort((a, b) => b.score - a.score);
}
