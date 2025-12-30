import { DailyEntry } from "../types";
import * as ss from "simple-statistics";

interface AggregatedStats {
  avgMood: number;
  avgEnergy: number;
  avgSleep: number;
  avgFocus: number;
  totalEntries: number;
  topTags: [string, number][];
}

function calculateStats(entries: DailyEntry[]): AggregatedStats {
  if (entries.length === 0) {
    return {
      avgMood: 0,
      avgEnergy: 0,
      avgSleep: 0,
      avgFocus: 0,
      totalEntries: 0,
      topTags: [],
    };
  }

  const moods = entries.map((e) => e.metrics.mood);
  const energies = entries.map((e) => e.metrics.energy);
  const sleeps = entries.map((e) => e.metrics.sleep);
  const focuses = entries.map((e) => e.metrics.focus);

  const tagCounts: Record<string, number> = {};
  entries.forEach((e) => {
    if (e.checkboxes) {
      Object.entries(e.checkboxes).forEach(([tag, checked]) => {
        if (checked) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      });
    }
  });

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return {
    avgMood: Number(ss.mean(moods).toFixed(1)),
    avgEnergy: Number(ss.mean(energies).toFixed(1)),
    avgSleep: Number(ss.mean(sleeps).toFixed(1)),
    avgFocus: Number(ss.mean(focuses).toFixed(1)),
    totalEntries: entries.length,
    topTags,
  };
}

export function generateEmailTemplate(
  period: "Weekly" | "Monthly",
  entries: DailyEntry[],
  startDate: string,
  endDate: string
): string {
  const stats = calculateStats(entries);

  const moodColor = (val: number) => {
    if (val >= 4) return "#4ade80"; // green
    if (val >= 3) return "#facc15"; // yellow
    return "#f87171"; // red
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: sans-serif; color: #333; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .card { background: #f9fafb; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .metric-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .metric-label { font-weight: bold; }
        .metric-value { font-weight: bold; }
        .tag-list { list-style: none; padding: 0; }
        .tag-item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; }
        .footer { text-align: center; font-size: 12px; color: #888; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Your ${period} Moodly Recap</h1>
          <p>${startDate} - ${endDate}</p>
        </div>

        <div class="card">
          <h2>Overview</h2>
          <p>You tracked your mood <strong>${stats.totalEntries}</strong> times this ${period.toLowerCase()}.</p>
          
          <div class="metric-row">
            <span class="metric-label">Average Mood</span>
            <span class="metric-value" style="color: ${moodColor(stats.avgMood)}">${stats.avgMood}/5</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Average Energy</span>
            <span class="metric-value">${stats.avgEnergy}/5</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Average Sleep</span>
            <span class="metric-value">${stats.avgSleep}/5</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Average Focus</span>
            <span class="metric-value">${stats.avgFocus}/5</span>
          </div>
        </div>

        <div class="card">
          <h2>Top Activities</h2>
          <ul class="tag-list">
            ${stats.topTags
              .map(
                ([tag, count]) => `
              <li class="tag-item">
                <span>${tag.replace(/([A-Z])/g, " $1").trim()}</span>
                <span>${count}x</span>
              </li>
            `
              )
              .join("")}
          </ul>
        </div>

        <div class="footer">
          <p>Sent by Moodly. You can change your email preferences in the app settings.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
