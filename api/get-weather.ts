import { withApi, createErrorResponse, createSuccessResponse } from "../utils/api";
import { fetchJson } from "../utils/http";

/**
 * Weather API using Open-Meteo (free, no API key required)
 *
 * Query params:
 * - lat: latitude
 * - lon: longitude
 * - date: YYYY-MM-DD (optional, defaults to today for current weather)
 *
 * Returns:
 * - temperature: average temperature (10am-8pm) in Celsius
 * - condition: weather condition string (sunny, cloudy, rainy, etc.)
 * - conditionCode: WMO weather code
 * - humidity: relative humidity %
 * - precipitation: precipitation in mm
 * - windSpeed: wind speed in km/h
 */

// WMO Weather interpretation codes
const WMO_CODES: Record<number, { condition: string; icon: string }> = {
  0: { condition: 'Clear sky', icon: 'sunny' },
  1: { condition: 'Mainly clear', icon: 'sunny' },
  2: { condition: 'Partly cloudy', icon: 'partly-cloudy' },
  3: { condition: 'Overcast', icon: 'cloudy' },
  45: { condition: 'Foggy', icon: 'foggy' },
  48: { condition: 'Depositing rime fog', icon: 'foggy' },
  51: { condition: 'Light drizzle', icon: 'drizzle' },
  53: { condition: 'Moderate drizzle', icon: 'drizzle' },
  55: { condition: 'Dense drizzle', icon: 'drizzle' },
  56: { condition: 'Light freezing drizzle', icon: 'drizzle' },
  57: { condition: 'Dense freezing drizzle', icon: 'drizzle' },
  61: { condition: 'Slight rain', icon: 'rainy' },
  63: { condition: 'Moderate rain', icon: 'rainy' },
  65: { condition: 'Heavy rain', icon: 'rainy' },
  66: { condition: 'Light freezing rain', icon: 'rainy' },
  67: { condition: 'Heavy freezing rain', icon: 'rainy' },
  71: { condition: 'Slight snow fall', icon: 'snowy' },
  73: { condition: 'Moderate snow fall', icon: 'snowy' },
  75: { condition: 'Heavy snow fall', icon: 'snowy' },
  77: { condition: 'Snow grains', icon: 'snowy' },
  80: { condition: 'Slight rain showers', icon: 'rainy' },
  81: { condition: 'Moderate rain showers', icon: 'rainy' },
  82: { condition: 'Violent rain showers', icon: 'rainy' },
  85: { condition: 'Slight snow showers', icon: 'snowy' },
  86: { condition: 'Heavy snow showers', icon: 'snowy' },
  95: { condition: 'Thunderstorm', icon: 'stormy' },
  96: { condition: 'Thunderstorm with slight hail', icon: 'stormy' },
  99: { condition: 'Thunderstorm with heavy hail', icon: 'stormy' },
};

function getWeatherInfo(code: number): { condition: string; icon: string } {
  return WMO_CODES[code] ?? { condition: 'Unknown', icon: 'unknown' };
}

interface OpenMeteoHourly {
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    weather_code?: number[];
    precipitation?: number[];
    wind_speed_10m?: number[];
  };
}

const HOURLY_FIELDS = 'temperature_2m,weather_code,precipitation,wind_speed_10m';

const average = (vals: number[]): number | null =>
  vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

/** Summarises hourly data over the daytime window (10am-8pm local time). */
function summarizeDaytime(hourly: NonNullable<OpenMeteoHourly['hourly']>) {
  const daytime = (vals: number[] | undefined) => (vals ?? []).slice(10, 20);
  const temps = daytime(hourly.temperature_2m);
  const codes = daytime(hourly.weather_code);
  const precip = daytime(hourly.precipitation);
  const winds = daytime(hourly.wind_speed_10m);

  // Most frequent weather code during daytime
  const codeCounts = new Map<number, number>();
  for (const code of codes) codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
  const weatherCode = [...codeCounts.entries()].sort(([, a], [, b]) => b - a)[0]?.[0] ?? 0;
  const weatherInfo = getWeatherInfo(weatherCode);

  return {
    temperature: average(temps),
    condition: weatherInfo.condition,
    conditionCode: weatherCode,
    icon: weatherInfo.icon,
    precipitation: precip.reduce((a, b) => a + b, 0),
    windSpeed: average(winds),
  };
}

export default withApi({ methods: ['GET'] }, async (req, res) => {
  const { lat, lon, date } = req.query;

  if (!lat || !lon || typeof lat !== 'string' || typeof lon !== 'string') {
    return res.status(400).json(createErrorResponse('lat and lon query parameters are required'));
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);

  if (isNaN(latitude) || isNaN(longitude)) {
    return res.status(400).json(createErrorResponse('Invalid lat/lon values'));
  }

  const today = new Date().toISOString().split('T')[0];
  const requestDate = typeof date === 'string' ? date : today;
  const isHistorical = requestDate < today;

  // Archive API for past dates, forecast API for today/future
  const url = isHistorical
    ? `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${requestDate}&end_date=${requestDate}&hourly=${HOURLY_FIELDS}&timezone=auto`
    : `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=${HOURLY_FIELDS}&timezone=auto&forecast_days=1`;

  try {
    const data = await fetchJson<OpenMeteoHourly>(url);

    if (!data.hourly?.time?.length) {
      return res.status(404).json(createErrorResponse(
        isHistorical ? 'No weather data available for this date' : 'No weather data available',
      ));
    }

    return res.status(200).json(createSuccessResponse({
      ...summarizeDaytime(data.hourly),
      date: isHistorical ? requestDate : today,
      isHistorical,
    }));
  } catch (error) {
    console.error('Error fetching weather:', error);
    return res.status(500).json(createErrorResponse('Failed to fetch weather data'));
  }
});
