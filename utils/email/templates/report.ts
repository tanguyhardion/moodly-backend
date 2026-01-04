import { DailyEntry } from "../../../types";
import * as ss from "simple-statistics";
import { wrapInBaseTemplate } from "./base";

interface AggregatedStats {
  avgMood: number;
  avgEnergy: number;
  avgSleep: number;
  avgFocus: number;
  avgStress: number;
  avgLook: number;
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
      avgStress: 0,
      avgLook: 0,
      totalEntries: 0,
      topTags: [],
    };
  }

  const moods = entries.map((e) => e.metrics.mood);
  const energies = entries.map((e) => e.metrics.energy);
  const sleeps = entries.map((e) => e.metrics.sleep);
  const focuses = entries.map((e) => e.metrics.focus);
  const stresses = entries.map((e) => e.metrics.stress);
  const looks = entries.map((e) => e.metrics.look);

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
    avgStress: Number(ss.mean(stresses).toFixed(1)),
    avgLook: Number(ss.mean(looks).toFixed(1)),
    totalEntries: entries.length,
    topTags,
  };
}

export function generateReportTemplate(
  period: "Weekly" | "Monthly",
  entries: DailyEntry[],
  startDate: string,
  endDate: string,
): string {
  const stats = calculateStats(entries);

  const metricColor = (val: number) => {
    if (val >= 4) return "#4ade80"; // green
    if (val >= 3) return "#facc15"; // yellow
    return "#f87171"; // red
  };

  const content = `
    <div class="card">
      <h2>Overview</h2>
      <p style="margin-bottom: 20px;">You tracked your mood <strong>${
        stats.totalEntries
      }</strong> times this ${period.toLowerCase().slice(0, -2)}. Here's how your metrics averaged out:</p>
      
      <div class="metric-row">
        <span class="metric-label">Average Mood</span>
        <span class="metric-value" style="color: ${metricColor(
          stats.avgMood,
        )}">${stats.avgMood} / 5</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Average Energy</span>
        <span class="metric-value" style="color: ${metricColor(
          stats.avgEnergy,
        )}">${stats.avgEnergy} / 5</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Average Sleep</span>
        <span class="metric-value" style="color: ${metricColor(
          stats.avgSleep,
        )}">${stats.avgSleep} / 5</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Average Focus</span>
        <span class="metric-value" style="color: ${metricColor(
          stats.avgFocus,
        )}">${stats.avgFocus} / 5</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Average Stress</span>
        <span class="metric-value" style="color: ${metricColor(
          stats.avgStress,
        )}">${stats.avgStress} / 5</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Average Look</span>
        <span class="metric-value" style="color: ${metricColor(
          stats.avgLook,
        )}">${stats.avgLook} / 5</span>
      </div>
    </div>

    ${
      stats.topTags.length > 0
        ? `
    <div class="card">
      <h2>Top Activities</h2>
      <table class="tag-table">
        ${stats.topTags
          .map(
            ([tag, count]) => `
          <tr class="tag-item-row">
            <td class="tag-name">${tag.replace(/([A-Z])/g, " $1").trim()}</td>
            <td class="tag-count-cell"><span class="tag-count">${count}x</span></td>
          </tr>
        `,
          )
          .join("")}
      </table>
    </div>
    `
        : ""
    }
  `;

  return wrapInBaseTemplate(
    content,
    "Moodly Recap",
    `${period} Update: ${startDate} - ${endDate}`,
    `You're receiving this because you enabled ${period.toLowerCase()} updates in your Moodly settings.`,
  );
}
