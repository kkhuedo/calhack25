/**
 * Berkeley-Focused Parking Data Seeding
 *
 * Seeds parking data specifically for Berkeley area using:
 * - Google Places API (parking lots, garages)
 * - OpenStreetMap (street parking)
 */

import 'dotenv/config';
import { db } from "../server/db";
import { parkingSlots } from "../shared/schema";
import { sql } from "drizzle-orm";

// Import fetchers
import { fetchAllGooglePlaces } from "./fetchers/google-places";
import { fetchAllOSMParking, BAY_AREA_REGIONS } from "./fetchers/openstreetmap";

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🌱 BERKELEY PARKING DATA SEEDING");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (!db) {
    console.error("❌ Database not configured. Please set DATABASE_URL environment variable.");
    process.exit(1);
  }

  try {
    const beforeCount = await db.select({ count: sql<number>`count(*)` }).from(parkingSlots);
    console.log(`📊 Current spots in database: ${beforeCount[0].count}\n`);

    let totalSeeded = 0;

    // 1. Google Places - Berkeley Area
    console.log("━━━ SOURCE 1: GOOGLE PLACES (BERKELEY) ━━━");
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyDSRPi7RAKkm3P79zjsxPqiOVFtOwUgzxM';

    // Berkeley-specific search grid
    const berkeleyGrid = [
      { lat: 37.8716, lon: -122.2727, name: 'Berkeley Downtown' },
      { lat: 37.8825, lon: -122.2589, name: 'Berkeley North/Hills' },
      { lat: 37.8600, lon: -122.2800, name: 'Berkeley South' },
      { lat: 37.8697, lon: -122.2584, name: 'UC Berkeley Campus' },
      { lat: 37.8764, lon: -122.2672, name: 'Berkeley Telegraph Ave' },
      { lat: 37.8404, lon: -122.2889, name: 'Emeryville' },
    ];

    try {
      const places = await fetchAllGooglePlaces(googleApiKey, berkeleyGrid, 1500);

      let inserted = 0;
      console.log(`📝 Inserting ${places.length} spots from Google Places...`);

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
            spotCount: place.spotType === 'garage' ? 100 : 50,
            restrictions: {
              rating: place.rating,
              totalRatings: place.totalRatings,
              placeId: place.placeId,
            },
          }).onConflictDoNothing();

          inserted++;

          if (inserted % 25 === 0) {
            console.log(`  ✓ Inserted ${inserted} spots...`);
          }
        } catch (error) {
          // Skip duplicates
        }
      }

      console.log(`✅ Successfully seeded ${inserted} parking spots from Google Places`);
      totalSeeded += inserted;
    } catch (error) {
      console.error("❌ Error seeding Google Places:", error);
    }

    console.log();

    // 2. OpenStreetMap - Berkeley Area
    console.log("━━━ SOURCE 2: OPENSTREETMAP (BERKELEY) ━━━");

    // Berkeley-specific regions
    const berkeleyRegions = BAY_AREA_REGIONS.filter(region =>
      region.name.includes('Berkeley') || region.name.includes('Emeryville')
    );

    try {
      const spots = await fetchAllOSMParking(berkeleyRegions);

      let inserted = 0;
      console.log(`📝 Inserting ${spots.length} spots from OpenStreetMap...`);

      for (const spot of spots) {
        try {
          await db.insert(parkingSlots).values({
            latitude: spot.latitude,
            longitude: spot.longitude,
            address: spot.name || "Berkeley parking area",
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

          if (inserted % 25 === 0) {
            console.log(`  ✓ Inserted ${inserted} spots...`);
          }
        } catch (error) {
          // Skip duplicates
        }
      }

      console.log(`✅ Successfully seeded ${inserted} parking areas from OSM`);
      totalSeeded += inserted;
    } catch (error) {
      console.error("❌ Error seeding OSM:", error);
    }

    console.log();

    // Final summary
    const afterCount = await db.select({ count: sql<number>`count(*)` }).from(parkingSlots);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ BERKELEY SEEDING COMPLETE!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📊 Total spots in database: ${afterCount[0].count}`);
    console.log(`➕ New spots added: ${totalSeeded}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log("💡 Your app will now show Berkeley parking spots!");
    console.log("   Run: npm run dev");
    console.log("   Then open: http://localhost:8080\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

main();
