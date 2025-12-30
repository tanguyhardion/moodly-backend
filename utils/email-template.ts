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
  endDate: string,
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
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
          color: #374151; 
          line-height: 1.5; 
          margin: 0; 
          padding: 0;
          background-color: #f3f4f6;
        }
        .wrapper {
          width: 100%;
          table-layout: fixed;
          background-color: #f3f4f6;
          padding-bottom: 40px;
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background-color: #ffffff;
          border-radius: 16px;
          margin-top: 40px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .header { 
          background: linear-gradient(135deg, #ff6b9d 0%, #ffa06b 100%);
          padding: 40px 20px; 
          text-align: center; 
          color: white;
        }
        .logo {
          width: 64px;
          height: 64px;
          margin-bottom: 16px;
          border-radius: 16px;
        }
        .header h1 { 
          margin: 0; 
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.025em;
        }
        .header p {
          margin: 8px 0 0;
          opacity: 0.9;
          font-size: 16px;
        }
        .content {
          padding: 32px 24px;
        }
        .card { 
          background: #f9fafb; 
          padding: 24px; 
          border-radius: 12px; 
          margin-bottom: 24px; 
          border: 1px solid #f3f4f6;
        }
        .card h2 {
          margin-top: 0;
          font-size: 18px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 16px;
        }
        .metric-row { 
          display: block;
          margin-bottom: 16px; 
          background: white;
          padding: 12px 16px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }
        .metric-label { 
          font-size: 12px;
          font-weight: 600; 
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          display: block;
          margin-bottom: 4px;
        }
        .metric-value { 
          font-size: 20px;
          font-weight: 800; 
          color: #111827;
        }
        .tag-table { width: 100%; border-collapse: collapse; }
        .tag-item-row td { 
          padding: 12px 0; 
          border-bottom: 1px solid #e5e7eb; 
        }
        .tag-item-row:last-child td { border-bottom: none; }
        .tag-name { font-weight: 600; color: #4b5563; }
        .tag-count-cell { text-align: right; }
        .tag-count { 
          background: #e5e7eb; 
          color: #4b5563; 
          padding: 2px 10px; 
          border-radius: 20px; 
          font-size: 12px; 
          font-weight: 700;
          display: inline-block;
        }
        .footer { 
          text-align: center; 
          font-size: 13px; 
          color: #9ca3af; 
          margin-top: 20px; 
          padding: 0 20px;
        }
        .cta-container {
          text-align: center;
          margin-top: 8px;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #ff6b9d 0%, #ffa06b 100%);
          color: white !important;
          padding: 14px 28px;
          border-radius: 10px;
          text-decoration: none;
          font-weight: 700;
          font-size: 16px;
          box-shadow: 0 4px 6px -1px rgba(255, 107, 157, 0.2);
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <img src="https://tanguyhardion.github.io/moodly/logo.png" alt="Moodly Logo" class="logo">
            <h1>Moodly Recap</h1>
            <p>${period} Update: ${startDate} - ${endDate}</p>
          </div>

          <div class="content">
            <div class="card">
              <h2>Overview</h2>
              <p style="margin-bottom: 20px;">You tracked your mood <strong>${
                stats.totalEntries
              }</strong> times this ${period.toLowerCase()}. Here's how your metrics averaged out:</p>
              
              <div class="metric-row">
                <span class="metric-label">Average Mood</span>
                <span class="metric-value" style="color: ${moodColor(
                  stats.avgMood,
                )}">${stats.avgMood} / 5</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">Average Energy</span>
                <span class="metric-value">${stats.avgEnergy} / 5</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">Average Sleep</span>
                <span class="metric-value">${stats.avgSleep} / 5</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">Average Focus</span>
                <span class="metric-value">${stats.avgFocus} / 5</span>
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
                    <td class="tag-name">${tag
                      .replace(/([A-Z])/g, " $1")
                      .trim()}</td>
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

            <div class="cta-container">
              <a href="https://tanguyhardion.github.io/moodly" class="button">Open Moodly</a>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>You're receiving this because you enabled ${period.toLowerCase()} updates in your Moodly settings.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
