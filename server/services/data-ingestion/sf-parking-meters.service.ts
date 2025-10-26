/**
 * SF Parking Meters Data Ingestion
 *
 * Source: https://data.sfgov.org/Transportation/Parking-Meters/8vzz-qzz9
 * Records: ~28,000 parking meters
 * Updates: Monthly
 *
 * Each meter typically represents 1 parking spot
 */

import type { InsertParkingSpot } from "../../../shared/schema-v2";

interface SFParkingMeterRecord {
  post_id: string; // Unique meter post ID
  meter_id: string;
  meter_type: string; // 'SS', 'MS' (single/multi-space)
  street_name: string;
  street_num: string;
  latitude: string;
  longitude: string;
  cap_color: string; // Meter cap color
  smart_mete: string; // 'Y' or 'N'
  active_meter_flag: string; // 'Y' or 'N'
  meter_vendor: string; // 'IPS', 'Duncan', 'POM'
  on_offstreet_type: string; // 'ON' or 'OFF'
  clr_guid: string; // Blockface ID
}

export class SFParkingMetersService {
  private readonly BASE_URL = "https://data.sfgov.org/resource/8vzz-qzz9.json";
  private readonly BATCH_SIZE = 5000;

  /**
   * Fetch all active parking meters
   */
  async fetchAllMeters(): Promise<SFParkingMeterRecord[]> {
    const allMeters: SFParkingMeterRecord[] = [];
    let offset = 0;
    let hasMore = true;

    console.log('[SF Meters] Starting data fetch...');

    while (hasMore) {
      try {
        // Only fetch active meters
        const url = `${this.BASE_URL}?` +
          `$limit=${this.BATCH_SIZE}&` +
          `$offset=${offset}&` +
          `$where=active_meter_flag='Y'`;

        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const batch: SFParkingMeterRecord[] = await response.json();

        if (batch.length === 0) {
          hasMore = false;
        } else {
          allMeters.push(...batch);
          offset += this.BATCH_SIZE;
          console.log(`[SF Meters] Fetched ${allMeters.length} meters...`);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`[SF Meters] Error fetching batch at offset ${offset}:`, error);
        throw error;
      }
    }

    console.log(`[SF Meters] Fetch complete. Total meters: ${allMeters.length}`);
    return allMeters;
  }

  /**
   * Transform meter records to parking spots
   */
  transformToParkingSpots(meters: SFParkingMeterRecord[]): InsertParkingSpot[] {
    const spots: InsertParkingSpot[] = [];

    for (const meter of meters) {
      // Parse coordinates
      const latitude = parseFloat(meter.latitude);
      const longitude = parseFloat(meter.longitude);

      if (isNaN(latitude) || isNaN(longitude)) {
        console.warn(`[SF Meters] Invalid coordinates for meter ${meter.meter_id}, skipping`);
        continue;
      }

      // Multi-space meters can handle multiple cars
      const capacity = meter.meter_type === 'MS' ? 6 : 1; // MS meters typically cover ~6 spaces

      // Build address
      const address = `${meter.street_num} ${meter.street_name}, San Francisco, CA`;

      // Smart meters are newer and more reliable
      const isSmartMeter = meter.smart_mete === 'Y';
      const confidence = isSmartMeter ? 0.98 : 0.95;

      spots.push({
        latitude,
        longitude,
        address,
        spotType: 'metered',
        capacity,
        availableSpaces: 0, // Unknown initially
        primarySource: 'sf_meters',
        sourceId: meter.meter_id,
        confidence,
        verifiedSources: ['sf_meters'],
        regulations: {
          isMetered: true,
          meterType: meter.meter_type,
          days: 'Mon-Sat', // Typical SF meter hours
          hours: '8am-6pm', // Can be refined with regulations data
          colorCurb: meter.cap_color || undefined,
        },
        attributes: {
          evCharging: false, // TODO: cross-reference with EV charging data
        },
        metadata: {
          post_id: meter.post_id,
          meter_vendor: meter.meter_vendor,
          smart_meter: isSmartMeter,
          on_offstreet_type: meter.on_offstreet_type,
          blockface_id: meter.clr_guid,
        },
        isActive: true,
        needsVerification: false,
      });
    }

    console.log(`[SF Meters] Transformed ${spots.length} parking spots`);
    return spots;
  }

  /**
   * Ingest all meter data
   */
  async ingestAll(): Promise<InsertParkingSpot[]> {
    console.log('[SF Meters] ============================================');
    console.log('[SF Meters] Starting SF Parking Meters ingestion...');
    console.log('[SF Meters] ============================================\n');

    const meters = await this.fetchAllMeters();
    const spots = this.transformToParkingSpots(meters);

    console.log('\n[SF Meters] ============================================');
    console.log(`[SF Meters] Ingestion complete!`);
    console.log(`[SF Meters] Total spots ready for database: ${spots.length}`);
    console.log('[SF Meters] ============================================\n');

    return spots;
  }
}

// Singleton instance
export const sfParkingMetersService = new SFParkingMetersService();
