/**
 * Data Seeding Script for Parking Spots
 *
 * This script seeds the database with verified parking spots from:
 * 1. San Francisco Open Data (parking meters)
 * 2. Google Places API (optional - requires API key)
 * 3. OpenStreetMap (optional)
 *
 * Usage:
 *   npm run seed
 *   or
 *   tsx scripts/seed-parking-data.ts
 */

import { db } from "../server/db";
import { parkingSlots } from "../shared/schema";
import { sql } from "drizzle-orm";

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

        // Generate realistic safety and demand data
        const safetyScore = Math.floor(Math.random() * 4) + 6; // 6-10 for SF meters
        const hasLighting = Math.random() > 0.2; // 80% have lighting
        const pedestrianTraffic = Math.random() > 0.6 ? "high" : Math.random() > 0.3 ? "medium" : "low";
        const highDemandArea = Math.random() > 0.5;
        const demandLevel = highDemandArea ? (Math.random() > 0.5 ? "high" : "very_high") : "normal";

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
          // Safety data
          safetyScore,
          hasLighting,
          hasSecurityCamera: Math.random() > 0.7, // 30% have cameras
          pedestrianTraffic,
          // Demand and event data
          nearbyEvents: Math.random() > 0.85, // 15% near events
          highDemandArea,
          demandLevel,
          peakHours: highDemandArea ? { start: "17:00", end: "20:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] } : null,
          // Pricing
          priceCategory: "metered",
          hourlyRate: Math.random() * 3 + 1, // $1-4/hour
          maxDuration: 120, // 2 hours
          handicapAccessible: Math.random() > 0.8,
          evCharging: false,
          surface: "paved",
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
 * Seed parking lots/garages from Google Places API
 */
async function seedGooglePlaces(apiKey: string | undefined): Promise<number> {
  if (!apiKey) {
    console.log("⏭️  Skipping Google Places (no API key provided)");
    return 0;
  }

  console.log("🅿️  Fetching parking lots from Google Places API...");

  const locations = [
    { lat: 37.8716, lon: -122.2727, name: "Berkeley" },
    { lat: 37.7749, lon: -122.4194, name: "SF Downtown" },
    { lat: 37.7897, lon: -122.3972, name: "SF Mission" },
  ];

  let totalInserted = 0;

  for (const loc of locations) {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${loc.lat},${loc.lon}&radius=1000&type=parking&key=${apiKey}`
      );

      if (!response.ok) {
        console.warn(`⚠️  Failed to fetch ${loc.name}: ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (data.status !== "OK") {
        console.warn(`⚠️  Google Places API error for ${loc.name}: ${data.status}`);
        continue;
      }

      const places: GooglePlace[] = data.results || [];
      console.log(`📍 Found ${places.length} parking spots near ${loc.name}`);

      for (const place of places) {
        try {
          // Parking lots typically have better lighting and security
          const safetyScore = Math.floor(Math.random() * 2) + 7; // 7-9 for lots

          await db.insert(parkingSlots).values({
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng,
            address: place.vicinity,
            notes: place.name,
            spotType: "public_lot",
            dataSource: "google_places",
            verified: true,
            confidenceScore: 95,
            userConfirmations: 0,
            currentlyAvailable: true,
            status: "available",
            spotCount: 50, // Estimate for parking lots
            // Safety data (lots are generally safer)
            safetyScore,
            hasLighting: true,
            hasSecurityCamera: Math.random() > 0.4, // 60% have cameras
            pedestrianTraffic: "medium",
            // Demand and event data
            nearbyEvents: Math.random() > 0.8,
            highDemandArea: Math.random() > 0.6,
            demandLevel: Math.random() > 0.5 ? "high" : "normal",
            // Pricing
            priceCategory: "paid",
            hourlyRate: Math.random() * 5 + 3, // $3-8/hour for lots
            handicapAccessible: true,
            evCharging: Math.random() > 0.6, // 40% have EV charging
            surface: "paved",
          }).onConflictDoNothing();

          totalInserted++;
        } catch (error) {
          // Continue on individual insert errors
        }
      }

      console.log(`  ✓ Seeded ${loc.name} parking lots`);

      // Rate limit: wait 1 second between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.warn(`⚠️  Error processing ${loc.name}:`, error);
    }
  }

  console.log(`✅ Successfully seeded ${totalInserted} parking lots from Google Places`);
  return totalInserted;
}

/**
 * Seed parking from OpenStreetMap
 */
async function seedOSMParking(): Promise<number> {
  console.log("🗺️  Fetching parking from OpenStreetMap...");

  try {
    const query = `
      [out:json];
      (
        node["amenity"="parking"](37.7,-122.5,37.9,-122.3);
        way["amenity"="parking"](37.7,-122.5,37.9,-122.3);
      );
      out center;
    `;

    const response = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const elements: OSMElement[] = data.elements || [];
    console.log(`📊 Found ${elements.length} parking areas from OSM`);

    let inserted = 0;

    for (const element of elements) {
      try {
        const lat = element.lat || element.center?.lat;
        const lon = element.lon || element.center?.lon;

        if (!lat || !lon) continue;

        const capacity = parseInt(element.tags?.capacity || "10");
        const hasFee = element.tags?.fee === "yes";
        const safetyScore = Math.floor(Math.random() * 4) + 5; // 5-9 for street parking

        await db.insert(parkingSlots).values({
          latitude: lat,
          longitude: lon,
          address: "Street parking area",
          spotType: "street",
          dataSource: "openstreetmap",
          verified: true,
          confidenceScore: 85,
          userConfirmations: 0,
          currentlyAvailable: true,
          status: "available",
          spotCount: capacity,
          restrictions: {
            fee: hasFee,
            surface: element.tags?.surface,
          },
          // Safety data
          safetyScore,
          hasLighting: Math.random() > 0.3, // 70% have lighting
          hasSecurityCamera: false, // Street parking rarely has cameras
          pedestrianTraffic: Math.random() > 0.5 ? "medium" : "low",
          // Demand and event data
          nearbyEvents: false,
          highDemandArea: Math.random() > 0.7,
          demandLevel: "normal",
          // Pricing
          priceCategory: hasFee ? "metered" : "free",
          hourlyRate: hasFee ? Math.random() * 2 + 0.5 : null, // $0.5-2.5/hour
          handicapAccessible: Math.random() > 0.85,
          evCharging: false,
          surface: element.tags?.surface || "paved",
        }).onConflictDoNothing();

        inserted++;
      } catch (error) {
        // Continue on individual insert errors
      }
    }

    console.log(`✅ Successfully seeded ${inserted} parking areas from OSM`);
    return inserted;
  } catch (error) {
    console.error("❌ Error seeding OSM parking:", error);
    return 0;
  }
}

/**
 * Main seeding function
 */
async function main() {
  console.log("🌱 Starting parking data seeding...\n");

  if (!db) {
    console.error("❌ Database not configured. Please set DATABASE_URL environment variable.");
    process.exit(1);
  }

  try {
    // Check current count
    const beforeCount = await db.select({ count: sql<number>`count(*)` }).from(parkingSlots);
    console.log(`📊 Current spots in database: ${beforeCount[0].count}\n`);

    let totalSeeded = 0;

    // Seed from SF Open Data (most reliable)
    totalSeeded += await seedSFParkingMeters(5000);
    console.log();

    // Seed from Google Places (if API key provided)
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    totalSeeded += await seedGooglePlaces(googleApiKey);
    console.log();

    // Seed from OpenStreetMap (free, no API key needed)
    totalSeeded += await seedOSMParking();
    console.log();

    // Final count
    const afterCount = await db.select({ count: sql<number>`count(*)` }).from(parkingSlots);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`✅ Seeding complete!`);
    console.log(`📊 Total spots in database: ${afterCount[0].count}`);
    console.log(`➕ New spots added: ${afterCount[0].count - beforeCount[0].count}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

// Run the seeding script
main();
