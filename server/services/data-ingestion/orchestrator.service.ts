/**
 * Data Ingestion Orchestrator
 *
 * Coordinates all data ingestion services to build comprehensive parking spot database
 *
 * Flow:
 * 1. Ingest from multiple sources in parallel
 * 2. Deduplicate spots from different sources
 * 3. Return merged, deduplicated spots ready for database
 */

import { sfParkingCensusService } from "./sf-parking-census.service";
import { sfParkingMetersService } from "./sf-parking-meters.service";
import { sfParkingCitationsService } from "./sf-parking-citations.service";
import { deduplicationService } from "./deduplication.service";
import type { InsertParkingSpot } from "../../../shared/schema-v2";

export interface IngestionResult {
  totalSpots: number;
  bySource: {
    sf_parking_census: number;
    sf_meters: number;
    sf_citations: number;
  };
  duplicatesRemoved: number;
  finalSpotCount: number;
  spots: InsertParkingSpot[];
  errors: string[];
  duration: number; // milliseconds
}

export class DataIngestionOrchestrator {
  /**
   * Run all ingestion services
   */
  async ingestAll(options: {
    includeCensus?: boolean;
    includeMeters?: boolean;
    includeCitations?: boolean;
    citationMonthsBack?: number;
  } = {}): Promise<IngestionResult> {
    const startTime = Date.now();

    const {
      includeCensus = true,
      includeMeters = true,
      includeCitations = true,
      citationMonthsBack = 6,
    } = options;

    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║   PARKSHARE DATA INGESTION ORCHESTRATOR                ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('\n');

    const errors: string[] = [];
    const allSpots: InsertParkingSpot[] = [];
    const bySource = {
      sf_parking_census: 0,
      sf_meters: 0,
      sf_citations: 0,
    };

    // Ingest SF Parking Census
    if (includeCensus) {
      try {
        console.log('📊 [1/3] Ingesting SF Parking Census...\n');
        const censusSpots = await sfParkingCensusService.ingestAll();
        allSpots.push(...censusSpots);
        bySource.sf_parking_census = censusSpots.length;
      } catch (error) {
        const errorMsg = `SF Parking Census failed: ${error}`;
        console.error(`❌ ${errorMsg}\n`);
        errors.push(errorMsg);
      }
    }

    // Ingest SF Parking Meters
    if (includeMeters) {
      try {
        console.log('🅿️  [2/3] Ingesting SF Parking Meters...\n');
        const meterSpots = await sfParkingMetersService.ingestAll();
        allSpots.push(...meterSpots);
        bySource.sf_meters = meterSpots.length;
      } catch (error) {
        const errorMsg = `SF Parking Meters failed: ${error}`;
        console.error(`❌ ${errorMsg}\n`);
        errors.push(errorMsg);
      }
    }

    // Ingest SF Parking Citations
    if (includeCitations) {
      try {
        console.log('🚨 [3/3] Ingesting SF Parking Citations...\n');
        const citationSpots = await sfParkingCitationsService.ingestAll(citationMonthsBack);
        allSpots.push(...citationSpots);
        bySource.sf_citations = citationSpots.length;
      } catch (error) {
        const errorMsg = `SF Parking Citations failed: ${error}`;
        console.error(`❌ ${errorMsg}\n`);
        errors.push(errorMsg);
      }
    }

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  INGESTION COMPLETE - Starting Deduplication');
    console.log('═══════════════════════════════════════════════════════\n');

    const totalBeforeDedup = allSpots.length;

    // Deduplicate
    console.log('🔄 Deduplicating spots...\n');
    const deduplicatedSpots = deduplicationService.deduplicateFast(allSpots);
    const duplicatesRemoved = totalBeforeDedup - deduplicatedSpots.length;

    const duration = Date.now() - startTime;

    // Final stats
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║              INGESTION SUMMARY                         ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`📊 SF Parking Census:     ${bySource.sf_parking_census.toLocaleString()} spots`);
    console.log(`🅿️  SF Parking Meters:     ${bySource.sf_meters.toLocaleString()} spots`);
    console.log(`🚨 SF Parking Citations:  ${bySource.sf_citations.toLocaleString()} spots`);
    console.log('─────────────────────────────────────────────────────────');
    console.log(`📍 Total Ingested:        ${totalBeforeDedup.toLocaleString()} spots`);
    console.log(`🔄 Duplicates Removed:    ${duplicatesRemoved.toLocaleString()} spots`);
    console.log('═════════════════════════════════════════════════════════');
    console.log(`✅ FINAL SPOT COUNT:      ${deduplicatedSpots.length.toLocaleString()} spots`);
    console.log('═════════════════════════════════════════════════════════');
    console.log(`⏱️  Duration: ${(duration / 1000).toFixed(1)}s`);

    if (errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      errors.forEach(err => console.log(`   - ${err}`));
    }

    console.log('\n');

    return {
      totalSpots: totalBeforeDedup,
      bySource,
      duplicatesRemoved,
      finalSpotCount: deduplicatedSpots.length,
      spots: deduplicatedSpots,
      errors,
      duration,
    };
  }

  /**
   * Quick preview - fetch minimal data for testing
   */
  async previewIngestion(limit: number = 100): Promise<IngestionResult> {
    console.log(`\n🔍 Running preview ingestion (limit: ${limit})...\n`);

    const startTime = Date.now();

    // For preview, just fetch a small sample from meters (fastest source)
    try {
      const meterSpots = await sfParkingMetersService.ingestAll();
      const limitedSpots = meterSpots.slice(0, limit);

      const duration = Date.now() - startTime;

      console.log(`\n✅ Preview complete: ${limitedSpots.length} spots in ${(duration / 1000).toFixed(1)}s\n`);

      return {
        totalSpots: limitedSpots.length,
        bySource: {
          sf_parking_census: 0,
          sf_meters: limitedSpots.length,
          sf_citations: 0,
        },
        duplicatesRemoved: 0,
        finalSpotCount: limitedSpots.length,
        spots: limitedSpots,
        errors: [],
        duration,
      };
    } catch (error) {
      throw new Error(`Preview ingestion failed: ${error}`);
    }
  }

  /**
   * Incremental update - only fetch new/updated data
   * (For future implementation with last_updated tracking)
   */
  async incrementalUpdate(): Promise<IngestionResult> {
    // TODO: Implement incremental updates
    // - Track last ingestion timestamp per source
    // - Only fetch records updated since last ingestion
    // - Update existing spots, add new ones

    throw new Error('Incremental update not yet implemented');
  }
}

// Singleton instance
export const dataIngestionOrchestrator = new DataIngestionOrchestrator();
