import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  validateMasterPassword,
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
} from "../utils/auth";
import https from "https";

/**
 * Weather API using Open-Meteo (free, no API key required)
 *
 * Query params:
 * - lat: latitude
 * - lon: longitude
 * - date: YYYY-MM-DD (optional, defaults to today for current weather)
 *
 * Returns:
 * - temperature: average temperature in Celsius
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

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(new Error('Failed to parse response'));
            }
          } else {
            reject(new Error(`API error: ${res.statusCode} ${body}`));
          }
        });
      })
      .on('error', (err) => reject(err));
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (handleOptionsRequest(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json(createErrorResponse('Method not allowed'));
    return;
  }

  if (!validateMasterPassword(req)) {
    res.status(401).json(createErrorResponse('Invalid or missing master password'));
    return;
  }

  const { lat, lon, date } = req.query;

  if (!lat || !lon || typeof lat !== 'string' || typeof lon !== 'string') {
    res.status(400).json(createErrorResponse('lat and lon query parameters are required'));
    return;
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);

  if (isNaN(latitude) || isNaN(longitude)) {
    res.status(400).json(createErrorResponse('Invalid lat/lon values'));
    return;
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const requestDate = typeof date === 'string' ? date : today;
    const isHistorical = requestDate < today;

    let weatherData;

    if (isHistorical) {
      // Use historical/archive API for past dates
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${requestDate}&end_date=${requestDate}&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,wind_speed_10m_max&timezone=auto`;

      const data = await fetchJson(url);

      if (!data.daily || !data.daily.time || data.daily.time.length === 0) {
        res.status(404).json(createErrorResponse('No weather data available for this date'));
        return;
      }

      const weatherCode = data.daily.weather_code?.[0] ?? 0;
      const weatherInfo = getWeatherInfo(weatherCode);

      weatherData = {
        temperature: data.daily.temperature_2m_mean?.[0] ?? null,
        temperatureMax: data.daily.temperature_2m_max?.[0] ?? null,
        temperatureMin: data.daily.temperature_2m_min?.[0] ?? null,
        condition: weatherInfo.condition,
        conditionCode: weatherCode,
        icon: weatherInfo.icon,
        precipitation: data.daily.precipitation_sum?.[0] ?? 0,
        windSpeed: data.daily.wind_speed_10m_max?.[0] ?? null,
        date: requestDate,
        isHistorical: true,
      };
    } else {
      // Use forecast API for current/future dates
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,wind_speed_10m_max&timezone=auto&forecast_days=1`;

      const data = await fetchJson(url);

      if (!data.daily || !data.daily.time || data.daily.time.length === 0) {
        res.status(404).json(createErrorResponse('No weather data available'));
        return;
      }

      const weatherCode = data.daily.weather_code?.[0] ?? 0;
      const weatherInfo = getWeatherInfo(weatherCode);

      weatherData = {
        temperature: data.daily.temperature_2m_mean?.[0] ?? null,
        temperatureMax: data.daily?.temperature_2m_max?.[0] ?? null,
        temperatureMin: data.daily?.temperature_2m_min?.[0] ?? null,
        condition: weatherInfo.condition,
        conditionCode: weatherCode,
        icon: weatherInfo.icon,
        precipitation: data.daily?.precipitation_sum?.[0] ?? 0,
        windSpeed: data.daily?.wind_speed_10m_max?.[0] ?? null,
        date: today,
        isHistorical: false,
      };
    }

    res.status(200).json(createSuccessResponse(weatherData));
  } catch (error: any) {
    console.error('Error fetching weather:', error);
    res.status(500).json(createErrorResponse('Failed to fetch weather data'));
  }
}
