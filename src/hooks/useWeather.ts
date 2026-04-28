import { useState, useEffect } from 'react';

export interface WeatherForecast {
  date: string;            // YYYY-MM-DD
  tempMax: number;         // °C
  tempMin: number;         // °C
  precipitation: number;   // % chance
  weatherCode: number;     // WMO code
  emoji: string;
  label: string;
}

// WMO Weather interpretation (https://open-meteo.com/en/docs)
function describe(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: '☀️', label: 'Clear' };
  if (code <= 3) return { emoji: '⛅', label: 'Partly cloudy' };
  if (code <= 48) return { emoji: '🌫️', label: 'Foggy' };
  if (code <= 57) return { emoji: '🌦️', label: 'Drizzle' };
  if (code <= 67) return { emoji: '🌧️', label: 'Rain' };
  if (code <= 77) return { emoji: '❄️', label: 'Snow' };
  if (code <= 82) return { emoji: '🌦️', label: 'Showers' };
  if (code <= 86) return { emoji: '🌨️', label: 'Snow showers' };
  if (code <= 99) return { emoji: '⛈️', label: 'Storm' };
  return { emoji: '☁️', label: 'Cloudy' };
}

/**
 * Fetches a 7-day forecast for SCC's home city (Pune) via Open-Meteo (no API key).
 * Returns the forecast for the requested date, or null if outside the window.
 */
export function useWeather(targetDate: string | null, lat = 18.5204, lon = 73.8567) {
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!targetDate) { setForecast(null); return; }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(targetDate); target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0 || diffDays > 14) { setForecast(null); return; }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode` +
          `&timezone=auto&forecast_days=14`;
        const r = await fetch(url);
        const json = await r.json();
        if (cancelled) return;

        const idx = (json.daily?.time as string[] | undefined)?.indexOf(targetDate);
        if (idx == null || idx < 0) { setForecast(null); setLoading(false); return; }

        const code = json.daily.weathercode[idx];
        const desc = describe(code);
        setForecast({
          date: targetDate,
          tempMax: Math.round(json.daily.temperature_2m_max[idx]),
          tempMin: Math.round(json.daily.temperature_2m_min[idx]),
          precipitation: json.daily.precipitation_probability_max[idx] ?? 0,
          weatherCode: code,
          emoji: desc.emoji,
          label: desc.label,
        });
      } catch {
        if (!cancelled) setForecast(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [targetDate, lat, lon]);

  return { forecast, loading };
}
