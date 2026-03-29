import { DailyEntry, MetricConfig } from "../../../types";
import { wrapInBaseTemplate } from "./base";

interface SliderStat {
  label: string;
  avg: number;
  color?: string;
}

interface CheckboxStat {
  label: string;
  count: number;
}

interface AggregatedStats {
  sliderStats: SliderStat[];
  checkboxStats: CheckboxStat[];
  totalEntries: number;
}

function calculateStats(entries: DailyEntry[], metrics: MetricConfig[]): AggregatedStats {
  if (entries.length === 0) {
    return { sliderStats: [], checkboxStats: [], totalEntries: 0 };
  }

  const sliderMetrics = metrics.filter((m) => m.type === "slider" || m.type === "number");
  const checkboxMetrics = metrics.filter((m) => m.type === "checkbox");

  const sliderStats: SliderStat[] = sliderMetrics
    .map((metric) => {
      const values = entries
        .map((e) => e.data[metric.id])
        .filter((v): v is number => typeof v === "number");
      if (values.length === 0) return null;
      const avg = Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));
      return { label: metric.label, avg, color: metric.color };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const checkboxStats: CheckboxStat[] = checkboxMetrics
    .map((metric) => ({
      label: metric.label,
      count: entries.filter((e) => e.data[metric.id] === true).length,
    }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { sliderStats, checkboxStats, totalEntries: entries.length };
}

export function generateReportTemplate(
  period: "Weekly" | "Monthly",
  entries: DailyEntry[],
  metrics: MetricConfig[],
  startDate: string,
  endDate: string,
): string {
  const stats = calculateStats(entries, metrics);

  const metricColor = (val: number, metricColor?: string) => {
    if (metricColor) return metricColor;
    if (val >= 4) return "#4ade80";
    if (val >= 3) return "#facc15";
    return "#f87171";
  };

  const content = `
    <div class="card">
      <h2>Overview</h2>
      <p style="margin-bottom: 20px;">You tracked your mood <strong>${
        stats.totalEntries
      }</strong> times this ${period.toLowerCase().slice(0, -2)}. Here's how your metrics averaged out:</p>
      ${
        stats.sliderStats.length > 0
          ? stats.sliderStats
              .map(
                (s) => `
      <div class="metric-row">
        <span class="metric-label">${s.label}</span>
        <span class="metric-value" style="color: ${metricColor(s.avg, s.color)}">${s.avg}</span>
      </div>`
              )
              .join("")
          : "<p>No numeric metrics recorded this period.</p>"
      }
    </div>

    ${
      stats.checkboxStats.length > 0
        ? `
    <div class="card">
      <h2>Top Activities</h2>
      <table class="tag-table">
        ${stats.checkboxStats
          .map(
            ({ label, count }) => `
          <tr class="tag-item-row">
            <td class="tag-name">${label}</td>
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
