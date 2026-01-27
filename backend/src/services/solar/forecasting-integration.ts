/**
 * Forecasting Integration Service
 * Solar irradiance, weather, and power forecasting
 */

import { EventEmitter } from 'events';
import axios from 'axios';
import { logger } from '../../utils/logger';

// ============================================
// TYPES
// ============================================

export interface SolarPosition {
  azimuth: number;       // degrees from north
  altitude: number;      // degrees above horizon
  zenith: number;        // degrees from vertical
  hourAngle: number;     // degrees
}

export interface IrradianceData {
  timestamp: Date;
  ghi: number;           // Global Horizontal Irradiance (W/m2)
  dni: number;           // Direct Normal Irradiance (W/m2)
  dhi: number;           // Diffuse Horizontal Irradiance (W/m2)
  poa: number;           // Plane of Array Irradiance (W/m2)
  clearSkyGhi: number;   // Clear sky GHI (W/m2)
  clearSkyIndex: number; // Ratio of actual to clear sky
}

export interface WeatherData {
  timestamp: Date;
  temperature: number;   // Celsius
  humidity: number;      // %
  pressure: number;      // hPa
  windSpeed: number;     // m/s
  windDirection: number; // degrees
  cloudCover: number;    // %
  visibility: number;    // km
  precipitation: number; // mm/h
  uvIndex: number;
}

export interface PowerForecast {
  timestamp: Date;
  horizon: number;       // hours ahead
  powerKW: number;
  confidenceLow: number;
  confidenceHigh: number;
  irradiance: number;
  temperature: number;
  cloudCover: number;
}

export interface ForecastConfig {
  latitude: number;
  longitude: number;
  timezone: string;
  panelTiltDeg: number;
  panelAzimuthDeg: number;
  systemCapacityKW: number;
  efficiencyPercent: number;
  temperatureCoefficient: number; // %/°C
  weatherApiKey?: string;
  weatherApiUrl?: string;
  forecastHorizonHours: number;
  updateIntervalMinutes: number;
}

export interface DayAheadForecast {
  date: Date;
  sunrise: Date;
  sunset: Date;
  peakPowerKW: number;
  peakTime: Date;
  totalEnergyKWh: number;
  avgCloudCover: number;
  avgTemperature: number;
  hourlyForecast: PowerForecast[];
}

// ============================================
// SOLAR POSITION CALCULATOR
// ============================================

class SolarPositionCalculator {
  /**
   * Calculate solar position for given time and location
   */
  calculate(
    timestamp: Date,
    latitude: number,
    longitude: number
  ): SolarPosition {
    const jd = this.julianDay(timestamp);
    const t = (jd - 2451545.0) / 36525.0;

    // Mean longitude of the sun
    const L0 = (280.46646 + t * (36000.76983 + 0.0003032 * t)) % 360;

    // Mean anomaly of the sun
    const M = (357.52911 + t * (35999.05029 - 0.0001537 * t)) % 360;
    const Mrad = M * Math.PI / 180;

    // Equation of center
    const C = (1.914602 - t * (0.004817 + 0.000014 * t)) * Math.sin(Mrad) +
      (0.019993 - 0.000101 * t) * Math.sin(2 * Mrad) +
      0.000289 * Math.sin(3 * Mrad);

    // Sun's true longitude
    const trueLong = L0 + C;
    const trueLongRad = trueLong * Math.PI / 180;

    // Obliquity of ecliptic
    const obliquity = 23.439291 - 0.0130042 * t;
    const obliquityRad = obliquity * Math.PI / 180;

    // Sun's declination
    const sinDec = Math.sin(obliquityRad) * Math.sin(trueLongRad);
    const declination = Math.asin(sinDec);

    // Right ascension
    const y = Math.cos(obliquityRad) * Math.sin(trueLongRad);
    const x = Math.cos(trueLongRad);
    let rightAscension = Math.atan2(y, x);

    // Hour angle
    const gmst = this.greenwichMeanSiderealTime(jd);
    const localSiderealTime = (gmst + longitude) % 360;
    const hourAngle = localSiderealTime - (rightAscension * 180 / Math.PI);

    // Convert to radians
    const latRad = latitude * Math.PI / 180;
    const haRad = hourAngle * Math.PI / 180;

    // Altitude
    const sinAlt = Math.sin(latRad) * Math.sin(declination) +
      Math.cos(latRad) * Math.cos(declination) * Math.cos(haRad);
    const altitude = Math.asin(sinAlt) * 180 / Math.PI;

    // Azimuth
    const cosAz = (Math.sin(declination) - Math.sin(latRad) * sinAlt) /
      (Math.cos(latRad) * Math.cos(Math.asin(sinAlt)));
    let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * 180 / Math.PI;
    if (hourAngle > 0) azimuth = 360 - azimuth;

    return {
      azimuth,
      altitude,
      zenith: 90 - altitude,
      hourAngle: hourAngle % 360
    };
  }

  private julianDay(date: Date): number {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const d = date.getUTCDate();
    const h = date.getUTCHours() / 24;

    let jd = Math.floor(365.25 * (y + 4716)) +
      Math.floor(30.6001 * (m + 1)) + d + h - 1524.5;

    if (jd > 2299160) {
      const a = Math.floor(y / 100);
      jd = jd + 2 - a + Math.floor(a / 4);
    }

    return jd;
  }

  private greenwichMeanSiderealTime(jd: number): number {
    const t = (jd - 2451545.0) / 36525.0;
    const gmst = 280.46061837 +
      360.98564736629 * (jd - 2451545.0) +
      0.000387933 * t * t -
      t * t * t / 38710000;
    return gmst % 360;
  }
}

// ============================================
// IRRADIANCE MODEL
// ============================================

class IrradianceModel {
  private solarCalculator: SolarPositionCalculator;

  constructor() {
    this.solarCalculator = new SolarPositionCalculator();
  }

  /**
   * Calculate clear sky irradiance
   */
  calculateClearSky(
    timestamp: Date,
    latitude: number,
    longitude: number,
    altitude: number = 0
  ): IrradianceData {
    const position = this.solarCalculator.calculate(timestamp, latitude, longitude);

    if (position.altitude <= 0) {
      return {
        timestamp,
        ghi: 0,
        dni: 0,
        dhi: 0,
        poa: 0,
        clearSkyGhi: 0,
        clearSkyIndex: 1
      };
    }

    const zenithRad = position.zenith * Math.PI / 180;
    const cosZenith = Math.cos(zenithRad);

    // Extra-terrestrial irradiance
    const dayOfYear = this.dayOfYear(timestamp);
    const B = (2 * Math.PI * dayOfYear) / 365;
    const eccentricity = 1.00011 + 0.034221 * Math.cos(B) +
      0.00128 * Math.sin(B) + 0.000719 * Math.cos(2 * B);
    const G0 = 1361 * eccentricity; // Solar constant with correction

    // Air mass
    const airMass = 1 / (cosZenith + 0.50572 * Math.pow(96.07995 - position.zenith, -1.6364));
    const relativeAirMass = airMass * (Math.exp(-altitude / 8500));

    // Clear sky model (simplified Ineichen-Perez)
    const linke = 3.0; // Linke turbidity (typical clear sky)
    const fh1 = Math.exp(-altitude / 8000);
    const fh2 = Math.exp(-altitude / 1250);

    const cg1 = 5.09e-5 * altitude + 0.868;
    const cg2 = 3.92e-5 * altitude + 0.0387;

    const dniClear = G0 * Math.exp(-cg2 * relativeAirMass * (fh1 + fh2 * (linke - 1)));
    const dhiClear = G0 * (0.0939 + 0.0695 * Math.log(relativeAirMass)) *
      (1 + 0.0035 * (linke - 2));
    const ghiClear = dniClear * cosZenith + dhiClear;

    return {
      timestamp,
      ghi: Math.max(0, ghiClear),
      dni: Math.max(0, dniClear),
      dhi: Math.max(0, dhiClear),
      poa: Math.max(0, ghiClear), // Simplified, would need tilt calculation
      clearSkyGhi: Math.max(0, ghiClear),
      clearSkyIndex: 1
    };
  }

  /**
   * Apply cloud cover to clear sky irradiance
   */
  applyCloudCover(clearSky: IrradianceData, cloudCoverPercent: number): IrradianceData {
    const clearSkyIndex = 1 - (cloudCoverPercent / 100) * 0.75; // 75% reduction at 100% clouds

    return {
      ...clearSky,
      ghi: clearSky.ghi * clearSkyIndex,
      dni: clearSky.dni * Math.pow(clearSkyIndex, 2), // DNI more affected
      dhi: clearSky.dhi * (0.5 + 0.5 * clearSkyIndex), // DHI less affected
      poa: clearSky.poa * clearSkyIndex,
      clearSkyIndex
    };
  }

  /**
   * Calculate plane of array irradiance
   */
  calculatePOA(
    irradiance: IrradianceData,
    solarPosition: SolarPosition,
    tiltDeg: number,
    azimuthDeg: number
  ): number {
    const tiltRad = tiltDeg * Math.PI / 180;
    const azimuthRad = azimuthDeg * Math.PI / 180;
    const sunAzRad = solarPosition.azimuth * Math.PI / 180;
    const sunAltRad = solarPosition.altitude * Math.PI / 180;

    // Angle of incidence
    const cosAOI = Math.sin(sunAltRad) * Math.cos(tiltRad) +
      Math.cos(sunAltRad) * Math.sin(tiltRad) * Math.cos(sunAzRad - azimuthRad);

    const aoi = Math.acos(Math.max(-1, Math.min(1, cosAOI)));

    // POA components
    const poaBeam = irradiance.dni * Math.max(0, cosAOI);
    const poaDiffuse = irradiance.dhi * (1 + Math.cos(tiltRad)) / 2;
    const poaGround = irradiance.ghi * 0.2 * (1 - Math.cos(tiltRad)) / 2; // 0.2 albedo

    return poaBeam + poaDiffuse + poaGround;
  }

  private dayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
}

// ============================================
// FORECASTING INTEGRATION SERVICE
// ============================================

export class ForecastingIntegration extends EventEmitter {
  private static instance: ForecastingIntegration;

  private config: ForecastConfig;
  private solarCalculator: SolarPositionCalculator;
  private irradianceModel: IrradianceModel;

  private currentForecast: PowerForecast[] = [];
  private weatherCache: WeatherData[] = [];
  private updateInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();

    this.config = {
      latitude: -23.5505,  // Sao Paulo default
      longitude: -46.6333,
      timezone: 'America/Sao_Paulo',
      panelTiltDeg: 23,
      panelAzimuthDeg: 0, // North-facing in southern hemisphere
      systemCapacityKW: 1000,
      efficiencyPercent: 95,
      temperatureCoefficient: -0.4,
      forecastHorizonHours: 48,
      updateIntervalMinutes: 15
    };

    this.solarCalculator = new SolarPositionCalculator();
    this.irradianceModel = new IrradianceModel();
  }

  static getInstance(): ForecastingIntegration {
    if (!ForecastingIntegration.instance) {
      ForecastingIntegration.instance = new ForecastingIntegration();
    }
    return ForecastingIntegration.instance;
  }

  /**
   * Configure the forecasting service
   */
  configure(config: Partial<ForecastConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
    logger.info('Forecasting configuration updated');
    this.emit('configUpdated', this.config);
  }

  /**
   * Start forecast updates
   */
  startUpdates(): void {
    if (this.updateInterval) return;

    // Initial forecast
    this.updateForecast();

    this.updateInterval = setInterval(() => {
      this.updateForecast();
    }, this.config.updateIntervalMinutes * 60 * 1000);

    logger.info('Forecast updates started');
  }

  /**
   * Stop forecast updates
   */
  stopUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    logger.info('Forecast updates stopped');
  }

  /**
   * Update forecast
   */
  async updateForecast(): Promise<void> {
    try {
      // Fetch weather data
      const weather = await this.fetchWeatherForecast();
      this.weatherCache = weather;

      // Generate power forecast
      this.currentForecast = this.generatePowerForecast(weather);

      this.emit('forecastUpdated', {
        timestamp: new Date(),
        forecast: this.currentForecast
      });

      logger.debug(`Forecast updated: ${this.currentForecast.length} hours`);
    } catch (error) {
      logger.error('Failed to update forecast:', error);
      this.emit('forecastError', error);
    }
  }

  /**
   * Fetch weather forecast from API
   */
  private async fetchWeatherForecast(): Promise<WeatherData[]> {
    // If API is configured, fetch from it
    if (this.config.weatherApiKey && this.config.weatherApiUrl) {
      try {
        const response = await axios.get(this.config.weatherApiUrl, {
          params: {
            lat: this.config.latitude,
            lon: this.config.longitude,
            appid: this.config.weatherApiKey,
            units: 'metric',
            cnt: this.config.forecastHorizonHours
          }
        });

        return this.parseWeatherResponse(response.data);
      } catch (error) {
        logger.warn('Weather API failed, using simulation:', error);
      }
    }

    // Simulate weather if no API
    return this.simulateWeatherForecast();
  }

  /**
   * Parse weather API response
   */
  private parseWeatherResponse(data: any): WeatherData[] {
    // Generic parsing for common weather APIs
    const weather: WeatherData[] = [];

    if (data.list) {
      for (const item of data.list) {
        weather.push({
          timestamp: new Date(item.dt * 1000),
          temperature: item.main?.temp || 25,
          humidity: item.main?.humidity || 50,
          pressure: item.main?.pressure || 1013,
          windSpeed: item.wind?.speed || 3,
          windDirection: item.wind?.deg || 0,
          cloudCover: item.clouds?.all || 0,
          visibility: (item.visibility || 10000) / 1000,
          precipitation: item.rain?.['3h'] || 0,
          uvIndex: item.uvi || 5
        });
      }
    }

    return weather;
  }

  /**
   * Simulate weather forecast
   */
  private simulateWeatherForecast(): WeatherData[] {
    const weather: WeatherData[] = [];
    const now = new Date();

    for (let h = 0; h < this.config.forecastHorizonHours; h++) {
      const timestamp = new Date(now.getTime() + h * 3600000);
      const hour = timestamp.getHours();

      // Simulate daily temperature cycle
      const tempBase = 25;
      const tempAmplitude = 8;
      const tempPhase = (hour - 14) * Math.PI / 12; // Peak at 2 PM
      const temperature = tempBase + tempAmplitude * Math.cos(tempPhase);

      // Simulate cloud cover with some randomness
      const cloudBase = 30;
      const cloudVariation = 40;
      const cloudCover = Math.max(0, Math.min(100,
        cloudBase + cloudVariation * (Math.sin(h / 6) + 0.5 * (Math.random() - 0.5))
      ));

      weather.push({
        timestamp,
        temperature,
        humidity: 60 + Math.random() * 20,
        pressure: 1013 + Math.random() * 10 - 5,
        windSpeed: 2 + Math.random() * 5,
        windDirection: Math.random() * 360,
        cloudCover,
        visibility: 10,
        precipitation: cloudCover > 80 ? Math.random() * 2 : 0,
        uvIndex: hour >= 10 && hour <= 16 ? 8 - cloudCover / 20 : 0
      });
    }

    return weather;
  }

  /**
   * Generate power forecast from weather
   */
  private generatePowerForecast(weather: WeatherData[]): PowerForecast[] {
    const forecast: PowerForecast[] = [];

    for (let i = 0; i < weather.length; i++) {
      const w = weather[i];

      // Calculate clear sky irradiance
      const clearSky = this.irradianceModel.calculateClearSky(
        w.timestamp,
        this.config.latitude,
        this.config.longitude
      );

      // Apply cloud cover
      const actual = this.irradianceModel.applyCloudCover(clearSky, w.cloudCover);

      // Calculate solar position
      const position = this.solarCalculator.calculate(
        w.timestamp,
        this.config.latitude,
        this.config.longitude
      );

      // Calculate POA irradiance
      const poa = this.irradianceModel.calculatePOA(
        actual,
        position,
        this.config.panelTiltDeg,
        this.config.panelAzimuthDeg
      );

      // Calculate power output
      const stcIrradiance = 1000; // W/m2
      const stcTemp = 25; // °C
      const irradianceFactor = poa / stcIrradiance;

      // Temperature derating
      const tempDelta = w.temperature - stcTemp;
      const tempFactor = 1 + (this.config.temperatureCoefficient / 100) * tempDelta;

      // Final power calculation
      const powerKW = this.config.systemCapacityKW *
        irradianceFactor *
        Math.max(0.5, tempFactor) *
        (this.config.efficiencyPercent / 100);

      // Confidence bounds (wider with more cloud cover)
      const uncertainty = 0.1 + (w.cloudCover / 100) * 0.3;
      const confidenceLow = powerKW * (1 - uncertainty);
      const confidenceHigh = powerKW * (1 + uncertainty);

      forecast.push({
        timestamp: w.timestamp,
        horizon: i,
        powerKW: Math.max(0, powerKW),
        confidenceLow: Math.max(0, confidenceLow),
        confidenceHigh: Math.max(0, confidenceHigh),
        irradiance: poa,
        temperature: w.temperature,
        cloudCover: w.cloudCover
      });
    }

    return forecast;
  }

  /**
   * Get current power forecast
   */
  getForecast(): PowerForecast[] {
    return [...this.currentForecast];
  }

  /**
   * Get forecast for specific time
   */
  getForecastAt(timestamp: Date): PowerForecast | undefined {
    return this.currentForecast.find(f =>
      Math.abs(f.timestamp.getTime() - timestamp.getTime()) < 3600000
    );
  }

  /**
   * Get day ahead forecast
   */
  getDayAheadForecast(date?: Date): DayAheadForecast | null {
    const targetDate = date || new Date();
    targetDate.setHours(0, 0, 0, 0);

    const dayForecast = this.currentForecast.filter(f => {
      const fDate = new Date(f.timestamp);
      fDate.setHours(0, 0, 0, 0);
      return fDate.getTime() === targetDate.getTime();
    });

    if (dayForecast.length === 0) return null;

    // Find sunrise/sunset
    let sunrise: Date | null = null;
    let sunset: Date | null = null;

    for (let h = 0; h < 24; h++) {
      const time = new Date(targetDate);
      time.setHours(h);

      const position = this.solarCalculator.calculate(
        time,
        this.config.latitude,
        this.config.longitude
      );

      if (position.altitude > 0 && !sunrise) {
        sunrise = time;
      }
      if (position.altitude <= 0 && sunrise && !sunset) {
        sunset = time;
      }
    }

    // Calculate daily metrics
    const peakForecast = dayForecast.reduce((max, f) =>
      f.powerKW > max.powerKW ? f : max
    );

    const totalEnergy = dayForecast.reduce((sum, f) => sum + f.powerKW, 0); // Approximate kWh
    const avgCloudCover = dayForecast.reduce((sum, f) => sum + f.cloudCover, 0) / dayForecast.length;
    const avgTemp = dayForecast.reduce((sum, f) => sum + f.temperature, 0) / dayForecast.length;

    return {
      date: targetDate,
      sunrise: sunrise || new Date(targetDate.getTime() + 6 * 3600000),
      sunset: sunset || new Date(targetDate.getTime() + 18 * 3600000),
      peakPowerKW: peakForecast.powerKW,
      peakTime: peakForecast.timestamp,
      totalEnergyKWh: totalEnergy,
      avgCloudCover,
      avgTemperature: avgTemp,
      hourlyForecast: dayForecast
    };
  }

  /**
   * Get weather cache
   */
  getWeatherCache(): WeatherData[] {
    return [...this.weatherCache];
  }

  /**
   * Get current solar position
   */
  getCurrentSolarPosition(): SolarPosition {
    return this.solarCalculator.calculate(
      new Date(),
      this.config.latitude,
      this.config.longitude
    );
  }

  /**
   * Get configuration
   */
  getConfig(): ForecastConfig {
    return { ...this.config };
  }
}

// Export singleton
export const forecastingIntegration = ForecastingIntegration.getInstance();
