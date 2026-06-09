import { locationService } from './locationService';

// Open-Meteo is keyless and free for non-commercial use — good fit for a
// lightweight "is it safe to walk?" check without managing API credentials.
const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

export type WeatherCondition =
  | 'hot'
  | 'very_hot'
  | 'pleasant'
  | 'cool'
  | 'cold'
  | 'rain'
  | 'storm'
  | 'snow'
  | 'fog'
  | 'normal';

export interface WeatherSnapshot {
  temperatureC: number;
  apparentTemperatureC: number;
  weatherCode: number;
  humidityPct: number | null;
  condition: WeatherCondition;
  // Short human label — e.g. "29°C · Clear".
  shortLabel: string;
  // Greeting tail — appended to "Good morning, Dani". E.g. "Perfect weather for a walk".
  greetingTail: string;
  // Non-null when condition warrants a pre-walk advisory (rain, heat, etc).
  advisory: {
    severity: 'info' | 'warning' | 'danger';
    title: string;
    body: string;
    suggestIndoor: boolean;
  } | null;
  fetchedAt: number;
}

// WMO weather codes → high-level bucket. Reference:
// https://open-meteo.com/en/docs (search "WMO Weather interpretation codes")
function classifyWeatherCode(code: number): {
  bucket: 'clear' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm';
  label: string;
} {
  if (code === 0) return { bucket: 'clear', label: 'Clear' };
  if ([1, 2, 3].includes(code)) return { bucket: 'cloud', label: 'Cloudy' };
  if ([45, 48].includes(code)) return { bucket: 'fog', label: 'Foggy' };
  if (
    [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)
  )
    return { bucket: 'rain', label: 'Rainy' };
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return { bucket: 'snow', label: 'Snowy' };
  if ([95, 96, 99].includes(code))
    return { bucket: 'storm', label: 'Thunderstorm' };
  return { bucket: 'cloud', label: 'Mild' };
}

function classifyCondition(
  apparentTempC: number,
  weatherCode: number,
): WeatherCondition {
  const { bucket } = classifyWeatherCode(weatherCode);
  if (bucket === 'storm') return 'storm';
  if (bucket === 'rain') return 'rain';
  if (bucket === 'snow') return 'snow';
  if (bucket === 'fog') return 'fog';
  if (apparentTempC >= 35) return 'very_hot';
  if (apparentTempC >= 30) return 'hot';
  if (apparentTempC >= 18 && apparentTempC <= 26) return 'pleasant';
  if (apparentTempC >= 10 && apparentTempC < 18) return 'cool';
  if (apparentTempC < 10) return 'cold';
  return 'normal';
}

function buildGreetingTail(condition: WeatherCondition, tempLabel: string): string {
  switch (condition) {
    case 'pleasant':
      return `${tempLabel} — perfect walking weather`;
    case 'hot':
      return `${tempLabel} — hydrate before you head out`;
    case 'very_hot':
      return `${tempLabel} — consider walking early or indoors`;
    case 'cool':
      return `${tempLabel} — crisp morning, layer up`;
    case 'cold':
      return `${tempLabel} — bundle up if you head out`;
    case 'rain':
      return `${tempLabel} — rain expected, check before walking outside`;
    case 'storm':
      return `${tempLabel} — storms in your area, indoor session recommended`;
    case 'snow':
      return `${tempLabel} — snow conditions, tread carefully`;
    case 'fog':
      return `${tempLabel} — low visibility outside`;
    default:
      return tempLabel;
  }
}

function buildAdvisory(condition: WeatherCondition): WeatherSnapshot['advisory'] {
  switch (condition) {
    case 'very_hot':
      return {
        severity: 'danger',
        title: 'Heat advisory',
        body: 'It feels very hot right now. Walk early morning or late evening, take water, and slow your pace.',
        suggestIndoor: true,
      };
    case 'hot':
      return {
        severity: 'warning',
        title: 'Warm outside',
        body: 'Take water and consider an easier pace. Skip the walk if you feel dizzy.',
        suggestIndoor: false,
      };
    case 'rain':
      return {
        severity: 'warning',
        title: 'Rain expected',
        body: 'It’s raining nearby. Decide before you head out — indoor mode is a great fallback today.',
        suggestIndoor: true,
      };
    case 'storm':
      return {
        severity: 'danger',
        title: 'Storm warning',
        body: 'Thunderstorms reported in your area. Please don’t walk outside — switch to an indoor session.',
        suggestIndoor: true,
      };
    case 'snow':
      return {
        severity: 'warning',
        title: 'Snowy conditions',
        body: 'Watch your footing if you head out. Indoor mode keeps your streak safe.',
        suggestIndoor: true,
      };
    case 'cold':
      return {
        severity: 'info',
        title: 'Cold out there',
        body: 'Warm up well and layer up before stepping out.',
        suggestIndoor: false,
      };
    case 'fog':
      return {
        severity: 'info',
        title: 'Low visibility',
        body: 'Stick to lit, familiar routes — drivers may not see you easily.',
        suggestIndoor: false,
      };
    default:
      return null;
  }
}

async function fetchOpenMeteo(
  latitude: number,
  longitude: number,
): Promise<WeatherSnapshot | null> {
  const url =
    `${ENDPOINT}?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,apparent_temperature,weather_code,relative_humidity_2m` +
    `&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const current = json?.current;
  if (!current) return null;

  const temperatureC = Number(current.temperature_2m);
  const apparentTemperatureC = Number(
    current.apparent_temperature ?? current.temperature_2m,
  );
  const weatherCode = Number(current.weather_code ?? 0);
  const humidityPct = current.relative_humidity_2m != null
    ? Number(current.relative_humidity_2m)
    : null;

  const condition = classifyCondition(apparentTemperatureC, weatherCode);
  const { label } = classifyWeatherCode(weatherCode);
  const tempLabel = `${Math.round(temperatureC)}°C · ${label}`;

  return {
    temperatureC,
    apparentTemperatureC,
    weatherCode,
    humidityPct,
    condition,
    shortLabel: tempLabel,
    greetingTail: buildGreetingTail(condition, tempLabel),
    advisory: buildAdvisory(condition),
    fetchedAt: Date.now(),
  };
}

// 15 minutes — fresh enough to catch a shifting storm but cheap enough that
// returning to TodayScreen doesn't hammer Open-Meteo on every focus.
const CACHE_TTL_MS = 15 * 60 * 1000;
let memCache: WeatherSnapshot | null = null;

class WeatherService {
  async getCurrentWeather(force = false): Promise<WeatherSnapshot | null> {
    if (!force && memCache && Date.now() - memCache.fetchedAt < CACHE_TTL_MS) {
      return memCache;
    }
    try {
      const hasPermission = await locationService.checkPermissions();
      if (!hasPermission) return null;
      const point = await locationService.getCurrentLocation();
      if (!point) return null;
      const snapshot = await fetchOpenMeteo(point.latitude, point.longitude);
      if (snapshot) memCache = snapshot;
      return snapshot;
    } catch {
      // Network/location/API failure is expected (offline, denied permission,
      // upstream down). Weather is decorative — fail silently and let the UI
      // render without it. No log, no LogBox noise in dev.
      return null;
    }
  }

  clearCache() {
    memCache = null;
  }
}

export const weatherService = new WeatherService();
