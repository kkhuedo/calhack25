/**
 * SFpark API Integration
 *
 * Note: The original SFpark real-time API may no longer be active.
 * This service provides:
 * 1. SF Open Data integration for parking meters and regulations
 * 2. Placeholder for SFpark historical/availability data if API becomes available
 */

import type {
  SFparkAvailability,
  SFMeterData,
  SFParkingRegulation,
  Coordinates,
  BoundingBox,
  ParkingSegmentInfo,
} from "../../types/parking-data.types";
import { cache } from "../cache.service";

export class SFparkService {
  private readonly SF_OPENDATA_BASE = "https://data.sfgov.org/resource";
  private readonly CACHE_TTL = 1800; // 30 minutes for static data

  /**
   * Get parking meters in a bounding box
   * Dataset: Parking Meters
   * https://data.sfgov.org/Transportation/Parking-Meters/8vzz-qzz9
   */
  async getParkingMeters(bounds: BoundingBox): Promise<SFMeterData[]> {
    const cacheKey = `sfpark:meters:${JSON.stringify(bounds)}`;

    return cache.getOrSet(
      cacheKey,
      async () => {
        try {
          // SF Open Data SODA API
          const url = `${this.SF_OPENDATA_BASE}/8vzz-qzz9.json?$where=` +
            `latitude > ${bounds.south} AND latitude < ${bounds.north} AND ` +
            `longitude > ${bounds.west} AND longitude < ${bounds.east}` +
            `&$limit=1000`;

          console.log(`[SFpark] Fetching meters from SF Open Data...`);

          const response = await fetch(url, {
            headers: {
              'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(10000), // 10 second timeout
          });

          if (!response.ok) {
            throw new Error(`SF Open Data API error: ${response.statusText}`);
          }

          const data = await response.json();
          console.log(`[SFpark] Found ${data.length} parking meters`);

          return data as SFMeterData[];
        } catch (error) {
          console.error('[SFpark] Error fetching meters:', error);
          return [];
        }
      },
      this.CACHE_TTL
    );
  }

  /**
   * Get parking regulations for an area
   * Dataset: Parking Regulations (except non-metered color curb)
   * https://data.sfgov.org/Transportation/Map-of-Parking-Regulations/xewp-suj4
   */
  async getParkingRegulations(bounds: BoundingBox): Promise<SFParkingRegulation[]> {
    const cacheKey = `sfpark:regulations:${JSON.stringify(bounds)}`;

    return cache.getOrSet(
      cacheKey,
      async () => {
        try {
          // This dataset has different structure - need to check actual schema
          const url = `${this.SF_OPENDATA_BASE}/xewp-suj4.json?$limit=500`;

          console.log(`[SFpark] Fetching regulations from SF Open Data...`);

          const response = await fetch(url, {
            headers: {
              'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(10000),
          });

          if (!response.ok) {
            throw new Error(`SF Open Data API error: ${response.statusText}`);
          }

          const data = await response.json();
          console.log(`[SFpark] Found ${data.length} parking regulations`);

          return data as SFParkingRegulation[];
        } catch (error) {
          console.error('[SFpark] Error fetching regulations:', error);
          return [];
        }
      },
      this.CACHE_TTL
    );
  }

  /**
   * Get SFpark availability data (if real-time API is available)
   * This is a placeholder - the original SFpark API may be deprecated
   */
  async getAvailability(bounds: BoundingBox): Promise<SFparkAvailability[]> {
    const cacheKey = `sfpark:availability:${JSON.stringify(bounds)}`;

    return cache.getOrSet(
      cacheKey,
      async () => {
        try {
          // Note: This endpoint may not work - SFpark API was deprecated
          // Left as placeholder for future integration
          console.log(`[SFpark] Real-time availability API not currently available`);

          // If you get access to SFpark API, use this:
          // const url = `https://api.sfpark.org/sfpark/rest/availabilityservice?...`;
          // const response = await fetch(url);
          // return await response.json();

          return [];
        } catch (error) {
          console.error('[SFpark] Error fetching availability:', error);
          return [];
        }
      },
      300 // 5 minutes for real-time data
    );
  }

  /**
   * Transform SF meter data into ParkingSegmentInfo format
   */
  transformMetersToSegments(
    meters: SFMeterData[],
    userLocation: Coordinates
  ): ParkingSegmentInfo[] {
    // Group meters by street segment (same street + block)
    const segments = new Map<string, SFMeterData[]>();

    for (const meter of meters) {
      if (!meter.latitude || !meter.longitude) continue;

      const key = `${meter.street_name}_${meter.street_num}`;
      if (!segments.has(key)) {
        segments.set(key, []);
      }
      segments.get(key)!.push(meter);
    }

    // Transform to ParkingSegmentInfo
    const results: ParkingSegmentInfo[] = [];

    for (const [key, meterGroup] of segments) {
      const firstMeter = meterGroup[0];
      const lat = parseFloat(firstMeter.latitude);
      const lon = parseFloat(firstMeter.longitude);

      if (isNaN(lat) || isNaN(lon)) continue;

      const distance = this.calculateDistance(
        userLocation,
        { latitude: lat, longitude: lon }
      );

      results.push({
        id: `sfpark_${key}`,
        type: "street_segment",
        location: { latitude: lat, longitude: lon },
        address: `${firstMeter.street_num} ${firstMeter.street_name}, San Francisco, CA`,
        source: "sfpark",
        confidence: 0.7, // Static data, moderate confidence
        distance,
        totalSpaces: meterGroup.length,
        availableSpaces: 0, // Unknown without real-time data
        occupancyRate: 0.5, // Assume 50% occupied without real-time data
        regulations: {
          metered: true,
          timeLimit: undefined,
          hours: "8am-6pm Mon-Sat", // Common SF meter hours
        },
        lastUpdated: new Date(),
      });
    }

    return results.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Get parking availability summary for an area
   */
  async getParkingAvailabilitySummary(
    center: Coordinates,
    radiusMeters: number = 500
  ): Promise<ParkingSegmentInfo[]> {
    // Calculate bounding box from center and radius
    const latDelta = (radiusMeters / 111320); // 1 degree latitude ≈ 111.32 km
    const lonDelta = (radiusMeters / (111320 * Math.cos((center.latitude * Math.PI) / 180)));

    const bounds: BoundingBox = {
      north: center.latitude + latDelta,
      south: center.latitude - latDelta,
      east: center.longitude + lonDelta,
      west: center.longitude - lonDelta,
    };

    // Fetch meter data
    const meters = await this.getParkingMeters(bounds);

    // Transform to segment info
    return this.transformMetersToSegments(meters, center);
  }
}

// Singleton instance
export const sfparkService = new SFparkService();
