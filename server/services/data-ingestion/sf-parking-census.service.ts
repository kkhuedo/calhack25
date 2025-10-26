/**
 * SF Parking Census Data Ingestion
 *
 * Source: https://data.sfgov.org/Transportation/Parking-Census/fq9u-a2g7
 * Records: ~400,000 parking spaces
 * Updates: Annual
 *
 * This is the BEST source - gives exact counts of parking spaces per block
 */

import type { InsertParkingSpot } from "../../../shared/schema-v2";

interface SFParkingCensusRecord {
  cnn: string; // Centerline Network ID
  street_name: string;
  from_street: string;
  to_street: string;
  blockface_category: string; // "Street Parking", "Off-street", etc.
  noncurb_spaces: string; // Number as string
  curb_spaces: string;
  total_spaces: string;
  meters: string; // Number of meters
  payment_type: string; // "Metered", "Unmetered"
  geometry: {
    type: string;
    coordinates: number[][][]; // Polygon or LineString
  };
}

export class SFParkingCensusService {
  private readonly BASE_URL = "https://data.sfgov.org/resource/fq9u-a2g7.json";
  private readonly BATCH_SIZE = 1000;

  /**
   * Fetch all parking census records
   */
  async fetchAllRecords(): Promise<SFParkingCensusRecord[]> {
    const allRecords: SFParkingCensusRecord[] = [];
    let offset = 0;
    let hasMore = true;

    console.log('[SF Census] Starting data fetch...');

    while (hasMore) {
      try {
        const url = `${this.BASE_URL}?$limit=${this.BATCH_SIZE}&$offset=${offset}`;

        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const batch: SFParkingCensusRecord[] = await response.json();

        if (batch.length === 0) {
          hasMore = false;
        } else {
          allRecords.push(...batch);
          offset += this.BATCH_SIZE;
          console.log(`[SF Census] Fetched ${allRecords.length} records...`);
        }

        // Rate limiting - be nice to the API
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`[SF Census] Error fetching batch at offset ${offset}:`, error);
        throw error;
      }
    }

    console.log(`[SF Census] Fetch complete. Total records: ${allRecords.length}`);
    return allRecords;
  }

  /**
   * Transform census record to parking spot format
   */
  transformToParkingSpots(records: SFParkingCensusRecord[]): InsertParkingSpot[] {
    const spots: InsertParkingSpot[] = [];

    for (const record of records) {
      // Skip if no parking spaces
      const totalSpaces = parseInt(record.total_spaces || '0');
      if (totalSpaces === 0) continue;

      // Skip non-street parking for now (we'll handle lots separately)
      if (record.blockface_category !== 'Street Parking') continue;

      // Extract center point from geometry
      const { latitude, longitude } = this.extractCenterPoint(record.geometry);
      if (!latitude || !longitude) {
        console.warn(`[SF Census] No coordinates for CNN ${record.cnn}, skipping`);
        continue;
      }

      // Build address
      const address = this.buildAddress(record);

      // Determine spot type
      const isMetered = record.payment_type === 'Metered' || parseInt(record.meters || '0') > 0;
      const spotType = isMetered ? 'metered' : 'street';

      // Create spot
      spots.push({
        latitude,
        longitude,
        address,
        spotType,
        capacity: totalSpaces,
        availableSpaces: 0, // Unknown initially
        primarySource: 'sf_parking_census',
        sourceId: record.cnn,
        confidence: 0.95, // Official city data = high confidence
        verifiedSources: ['sf_parking_census'],
        regulations: {
          isMetered,
          days: undefined, // Need to cross-reference with regulations data
          hours: undefined,
        },
        attributes: {
          length: undefined, // Could calculate from geometry
        },
        metadata: {
          cnn: record.cnn,
          blockface_category: record.blockface_category,
          curb_spaces: parseInt(record.curb_spaces || '0'),
          noncurb_spaces: parseInt(record.noncurb_spaces || '0'),
          meters: parseInt(record.meters || '0'),
        },
        isActive: true,
        needsVerification: false,
      });
    }

    console.log(`[SF Census] Transformed ${spots.length} parking spots`);
    return spots;
  }

  /**
   * Extract center point from geometry
   */
  private extractCenterPoint(geometry: any): { latitude: number | null; longitude: number | null } {
    if (!geometry || !geometry.coordinates) {
      return { latitude: null, longitude: null };
    }

    try {
      if (geometry.type === 'LineString') {
        // Take midpoint of line
        const coords = geometry.coordinates;
        const midIndex = Math.floor(coords.length / 2);
        return {
          longitude: coords[midIndex][0],
          latitude: coords[midIndex][1],
        };
      } else if (geometry.type === 'Polygon') {
        // Take centroid of polygon
        const coords = geometry.coordinates[0]; // Outer ring
        const centroid = this.calculateCentroid(coords);
        return centroid;
      }
    } catch (error) {
      console.error('[SF Census] Error extracting coordinates:', error);
    }

    return { latitude: null, longitude: null };
  }

  /**
   * Calculate centroid of polygon
   */
  private calculateCentroid(coords: number[][]): { latitude: number; longitude: number } {
    let sumLon = 0;
    let sumLat = 0;

    for (const [lon, lat] of coords) {
      sumLon += lon;
      sumLat += lat;
    }

    return {
      longitude: sumLon / coords.length,
      latitude: sumLat / coords.length,
    };
  }

  /**
   * Build human-readable address
   */
  private buildAddress(record: SFParkingCensusRecord): string {
    const parts = [];

    if (record.street_name) {
      parts.push(record.street_name);
    }

    if (record.from_street && record.to_street) {
      parts.push(`(between ${record.from_street} & ${record.to_street})`);
    }

    parts.push('San Francisco, CA');

    return parts.join(' ');
  }

  /**
   * Ingest all census data
   * Returns array of spots to be inserted into database
   */
  async ingestAll(): Promise<InsertParkingSpot[]> {
    console.log('[SF Census] ============================================');
    console.log('[SF Census] Starting SF Parking Census ingestion...');
    console.log('[SF Census] ============================================\n');

    const records = await this.fetchAllRecords();
    const spots = this.transformToParkingSpots(records);

    console.log('\n[SF Census] ============================================');
    console.log(`[SF Census] Ingestion complete!`);
    console.log(`[SF Census] Total spots ready for database: ${spots.length}`);
    console.log('[SF Census] ============================================\n');

    return spots;
  }
}

// Singleton instance
export const sfParkingCensusService = new SFParkingCensusService();
