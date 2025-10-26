/**
 * Data Seeding Script for Parking Spots
 *
 * This script seeds the database with verified parking spots from:
 * 1. San Francisco Open Data (parking meters)
 * 2. SF Parking Regulations CSV (street segments with time limits)
 * 3. Google Places API (parking lots/garages - requires API key)
 * 4. OpenStreetMap (free, comprehensive coverage)
 *
 * Usage:
 *   npm run seed
 *   or
 *   tsx scripts/seed-parking-data.ts
 *
 * Environment Variables:
 *   GOOGLE_MAPS_API_KEY - Your Google Maps API key (optional)
 *   SF_PARKING_CSV_PATH - Path to SF parking regulations CSV (optional)
 */

// Load environment variables from .env file
import 'dotenv/config';

import { db } from "../server/db";
import { parkingSlots } from "../shared/schema";
import { sql } from "drizzle-orm";
import path from "path";
import fs from "fs";

// Import enhanced fetchers
import { fetchAllGooglePlaces } from "./fetchers/google-places";
import { fetchAllOSMParking } from "./fetchers/openstreetmap";
import { parseSFParkingRegulationsCSV, filterNearbySpots } from "./parsers/sf-parking-regulations";

interface SFParkingMeter {
  post_id: string;
  latitude: string;
  longitude: string;
  street_name: string;
  street_num: string;
  cap_color: string;
  active_met: string;
  smart_mete?: string;
}

interface GooglePlace {
  name: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  vicinity: string;
  types: string[];
}

interface OSMElement {
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: {
    capacity?: string;
    fee?: string;
    surface?: string;
  };
}

/**
 * Seed parking meters from San Francisco Open Data
 */
async function seedSFParkingMeters(limit: number = 5000): Promise<number> {
  console.log("🚗 Fetching SF parking meters from Open Data API...");

  try {
    const response = await fetch(
      `https://data.sfgov.org/resource/8vzz-qzz9.json?$limit=${limit}&active_met=M&$where=latitude IS NOT NULL`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const meters: SFParkingMeter[] = await response.json();
    console.log(`📊 Found ${meters.length} active parking meters`);

    let inserted = 0;
    let skipped = 0;

    for (const meter of meters) {
      try {
        const latitude = parseFloat(meter.latitude);
        const longitude = parseFloat(meter.longitude);

        if (isNaN(latitude) || isNaN(longitude)) {
          skipped++;
          continue;
        }

        const address = meter.street_num && meter.street_name
          ? `${meter.street_num} ${meter.street_name}, San Francisco, CA`
          : `${meter.street_name}, San Francisco, CA`;

        await db.insert(parkingSlots).values({
          latitude,
          longitude,
          address,
          spotType: "metered",
          dataSource: "sf_open_data",
          verified: true,
          confidenceScore: 98,
          userConfirmations: 0,
          currentlyAvailable: true,
          status: "available",
          spotCount: 1,
          restrictions: {
            meterColor: meter.cap_color,
            smartMeter: meter.smart_mete === "Y",
          },
        }).onConflictDoNothing();

        inserted++;

        // Log progress every 100 meters
        if (inserted % 100 === 0) {
          console.log(`  ✓ Inserted ${inserted} meters...`);
        }
      } catch (error) {
        skipped++;
        // Continue on individual insert errors
      }
    }

    console.log(`✅ Successfully seeded ${inserted} SF parking meters`);
    if (skipped > 0) {
      console.log(`⚠️  Skipped ${skipped} invalid entries`);
    }

    return inserted;
  } catch (error) {
    console.error("❌ Error seeding SF parking meters:", error);
    throw error;
  }
}

/**
 * Seed parking lots/garages from Google Places API (Enhanced)
 */
async function seedGooglePlaces(apiKey: string | undefined): Promise<number> {
  if (!apiKey) {
    console.log("⏭️  Skipping Google Places (no API key provided)");
    console.log("   💡 Set GOOGLE_MAPS_API_KEY environment variable to enable\n");
    return 0;
  }

  console.log("🅿️  Fetching parking from Google Places API (Enhanced)...");

  try {
    // Use enhanced fetcher with grid search
    const places = await fetchAllGooglePlaces(apiKey);

    let inserted = 0;
    let skipped = 0;

    console.log(`📝 Inserting ${places.length} parking spots into database...`);

    for (const place of places) {
      try {
        await db.insert(parkingSlots).values({
          latitude: place.latitude,
          longitude: place.longitude,
          address: place.address,
          notes: place.name,
          spotType: place.spotType as any,
          dataSource: "google_places",
          verified: true,
          confidenceScore: 95,
          userConfirmations: 0,
          currentlyAvailable: true,
          status: "available",
          spotCount: place.spotType === 'garage' ? 100 : 50, // Garages typically larger
          restrictions: {
            rating: place.rating,
            totalRatings: place.totalRatings,
            placeId: place.placeId,
          },
        }).onConflictDoNothing();

        inserted++;

        if (inserted % 50 === 0) {
          console.log(`  ✓ Inserted ${inserted} spots...`);
        }
      } catch (error) {
        skipped++;
      }
    }

    console.log(`✅ Successfully seeded ${inserted} parking lots from Google Places`);
    if (skipped > 0) {
      console.log(`⚠️  Skipped ${skipped} duplicates`);
    }
    return inserted;

  } catch (error) {
    console.error("❌ Error seeding Google Places:", error);
    return 0;
  }
}

/**
 * Seed parking from OpenStreetMap (Enhanced)
 */
async function seedOSMParking(): Promise<number> {
  console.log("🗺️  Fetching parking from OpenStreetMap (Enhanced)...");

  try {
    // Use enhanced fetcher with multiple regions
    const spots = await fetchAllOSMParking();

    let inserted = 0;
    let skipped = 0;

    console.log(`📝 Inserting ${spots.length} parking spots into database...`);

    for (const spot of spots) {
      try {
        await db.insert(parkingSlots).values({
          latitude: spot.latitude,
          longitude: spot.longitude,
          address: spot.name || "OSM parking area",
          notes: spot.operator,
          spotType: spot.spotType as any,
          dataSource: "openstreetmap",
          verified: true,
          confidenceScore: 85,
          userConfirmations: 0,
          currentlyAvailable: true,
          status: "available",
          spotCount: spot.capacity,
          restrictions: {
            fee: spot.fee,
            surface: spot.surface,
            access: spot.access,
            parkingType: spot.parkingType,
            osmId: spot.osmId,
            osmType: spot.osmType,
          },
        }).onConflictDoNothing();

        inserted++;

        if (inserted % 50 === 0) {
          console.log(`  ✓ Inserted ${inserted} spots...`);
        }
      } catch (error) {
        skipped++;
      }
    }

    console.log(`✅ Successfully seeded ${inserted} parking areas from OSM`);
    if (skipped > 0) {
      console.log(`⚠️  Skipped ${skipped} duplicates`);
    }
    return inserted;

  } catch (error) {
    console.error("❌ Error seeding OSM parking:", error);
    return 0;
  }
}

/**
 * Seed parking from SF Parking Regulations CSV
 */
async function seedSFParkingRegulations(csvPath: string | undefined): Promise<number> {
  if (!csvPath) {
    console.log("⏭️  Skipping SF Parking Regulations CSV (no path provided)");
    console.log("   💡 Set SF_PARKING_CSV_PATH environment variable to enable");
    console.log("   📄 Expected file: Parking_regulations_(except_non-metered_color_curb)_20251025.csv\n");
    return 0;
  }

  if (!fs.existsSync(csvPath)) {
    console.warn(`⚠️  CSV file not found: ${csvPath}\n`);
    return 0;
  }

  console.log("📄 Parsing SF Parking Regulations CSV...");

  try {
    // Parse CSV
    const allSpots = await parseSFParkingRegulationsCSV(csvPath);

    // Filter to SF area only (performance optimization)
    const SF_CENTER = { lat: 37.7749, lon: -122.4194 };
    const spots = filterNearbySpots(allSpots, SF_CENTER.lat, SF_CENTER.lon, 15); // 15km radius

    console.log(`📝 Inserting ${spots.length} parking segments into database...`);

    let inserted = 0;
    let skipped = 0;

    for (const spot of spots) {
      try {
        await db.insert(parkingSlots).values({
          latitude: spot.latitude,
          longitude: spot.longitude,
          address: spot.address,
          spotType: spot.spotType as any,
          dataSource: "sf_parking_regulations" as any, // May need to add this to schema
          verified: true,
          confidenceScore: spot.confidenceScore,
          userConfirmations: 0,
          currentlyAvailable: true,
          status: "available",
          spotCount: spot.spotCount,
          restrictions: spot.restrictions,
        }).onConflictDoNothing();

        inserted++;

        if (inserted % 100 === 0) {
          console.log(`  ✓ Inserted ${inserted} spots...`);
        }
      } catch (error) {
        skipped++;
      }
    }

    console.log(`✅ Successfully seeded ${inserted} parking segments from SF regulations`);
    if (skipped > 0) {
      console.log(`⚠️  Skipped ${skipped} duplicates or errors`);
    }
    return inserted;

  } catch (error) {
    console.error("❌ Error seeding SF parking regulations:", error);
    return 0;
  }
}

/**
 * Main seeding function
 */
async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🌱 PARKING DATA SEEDING - ENHANCED");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (!db) {
    console.error("❌ Database not configured. Please set DATABASE_URL environment variable.");
    process.exit(1);
  }

  try {
    // Check current count
    const beforeCount = await db.select({ count: sql<number>`count(*)` }).from(parkingSlots);
    console.log(`📊 Current spots in database: ${beforeCount[0].count}\n`);

    let totalSeeded = 0;
    const sourceCounts: Record<string, number> = {};

    // 1. Seed from SF Open Data (parking meters - most reliable)
    console.log("━━━ SOURCE 1: SF OPEN DATA (PARKING METERS) ━━━");
    const sfMetersCount = await seedSFParkingMeters(5000);
    sourceCounts['SF Parking Meters'] = sfMetersCount;
    totalSeeded += sfMetersCount;
    console.log();

    // 2. Seed from SF Parking Regulations CSV (street segments)
    console.log("━━━ SOURCE 2: SF PARKING REGULATIONS CSV ━━━");
    const csvPath = process.env.SF_PARKING_CSV_PATH;
    const sfRegulationsCount = await seedSFParkingRegulations(csvPath);
    sourceCounts['SF Parking Regulations'] = sfRegulationsCount;
    totalSeeded += sfRegulationsCount;
    console.log();

    // 3. Seed from Google Places (parking lots/garages)
    console.log("━━━ SOURCE 3: GOOGLE PLACES API ━━━");
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyDSRPi7RAKkm3P79zjsxPqiOVFtOwUgzxM';
    const googlePlacesCount = await seedGooglePlaces(googleApiKey);
    sourceCounts['Google Places'] = googlePlacesCount;
    totalSeeded += googlePlacesCount;
    console.log();

    // 4. Seed from OpenStreetMap (free, comprehensive)
    console.log("━━━ SOURCE 4: OPENSTREETMAP (OVERPASS API) ━━━");
    const osmCount = await seedOSMParking();
    sourceCounts['OpenStreetMap'] = osmCount;
    totalSeeded += osmCount;
    console.log();

    // Final summary
    const afterCount = await db.select({ count: sql<number>`count(*)` }).from(parkingSlots);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ SEEDING COMPLETE!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📊 Total spots in database: ${afterCount[0].count}`);
    console.log(`➕ New spots added: ${afterCount[0].count - beforeCount[0].count}`);
    console.log("\n📈 Breakdown by source:");
    Object.entries(sourceCounts).forEach(([source, count]) => {
      console.log(`   ${source}: ${count.toLocaleString()} spots`);
    });
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log("💡 Tips:");
    console.log("   - Run this script periodically to keep data fresh");
    console.log("   - Set GOOGLE_MAPS_API_KEY for parking lot/garage data");
    console.log("   - Set SF_PARKING_CSV_PATH for street segment data");
    console.log("   - OSM data is free and updates automatically\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

// Run the seeding script
main();
