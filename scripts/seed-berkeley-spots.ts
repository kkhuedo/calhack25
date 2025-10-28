/**
 * Seed Berkeley Parking Spots
 *
 * This script adds common parking locations in Berkeley, CA to the database.
 * Run this after setting up your DATABASE_URL in .env
 *
 * Usage: tsx scripts/seed-berkeley-spots.ts
 */

import 'dotenv/config';
import { db } from '../server/db';
import { parkingSlots } from '../shared/schema';

const berkeleyParkingSpots = [
  // Downtown Berkeley
  {
    latitude: 37.8703,
    longitude: -122.2680,
    address: '2120 Oxford St, Berkeley, CA 94704',
    notes: 'Downtown Berkeley BART parking',
    spotType: 'public_lot' as const,
    spotCount: 50,
  },
  {
    latitude: 37.8693,
    longitude: -122.2670,
    address: 'Center St & Shattuck Ave, Berkeley, CA',
    notes: 'Street parking near downtown',
    spotType: 'street' as const,
    spotCount: 10,
  },
  // UC Berkeley Campus Area
  {
    latitude: 37.8719,
    longitude: -122.2585,
    address: 'Telegraph Ave & Bancroft Way, Berkeley, CA',
    notes: 'Near UC Berkeley campus',
    spotType: 'metered' as const,
    spotCount: 15,
  },
  {
    latitude: 37.8735,
    longitude: -122.2595,
    address: 'Bancroft Way, Berkeley, CA',
    notes: 'Campus area street parking',
    spotType: 'metered' as const,
    spotCount: 8,
  },
  // North Berkeley
  {
    latitude: 37.8760,
    longitude: -122.2700,
    address: 'Hearst Ave & Euclid Ave, Berkeley, CA',
    notes: 'North Berkeley residential area',
    spotType: 'street' as const,
    spotCount: 12,
  },
  {
    latitude: 37.8785,
    longitude: -122.2650,
    address: 'Euclid Ave, Berkeley, CA',
    notes: 'Near campus north side',
    spotType: 'street' as const,
    spotCount: 10,
  },
  // West Berkeley
  {
    latitude: 37.8650,
    longitude: -122.2950,
    address: 'University Ave, Berkeley, CA 94710',
    notes: 'West Berkeley commercial area',
    spotType: 'street' as const,
    spotCount: 20,
  },
  {
    latitude: 37.8680,
    longitude: -122.3000,
    address: 'San Pablo Ave, Berkeley, CA',
    notes: 'West Berkeley shopping district',
    spotType: 'street' as const,
    spotCount: 15,
  },
  // South Berkeley
  {
    latitude: 37.8550,
    longitude: -122.2650,
    address: 'Dwight Way, Berkeley, CA',
    notes: 'South Berkeley residential',
    spotType: 'street' as const,
    spotCount: 10,
  },
  {
    latitude: 37.8600,
    longitude: -122.2700,
    address: 'Ashby Ave & Telegraph Ave, Berkeley, CA',
    notes: 'South Berkeley commercial',
    spotType: 'metered' as const,
    spotCount: 12,
  },
  // Berkeley Marina
  {
    latitude: 37.8650,
    longitude: -122.3150,
    address: 'Berkeley Marina, Berkeley, CA',
    notes: 'Marina parking lot',
    spotType: 'public_lot' as const,
    spotCount: 100,
  },
  // Solano Avenue
  {
    latitude: 37.8915,
    longitude: -122.2775,
    address: 'Solano Ave, Berkeley, CA',
    notes: 'Solano Avenue shopping district',
    spotType: 'metered' as const,
    spotCount: 20,
  },
  // Additional Campus Area Spots
  {
    latitude: 37.8740,
    longitude: -122.2610,
    address: 'Durant Ave, Berkeley, CA',
    notes: 'Near campus south side',
    spotType: 'metered' as const,
    spotCount: 8,
  },
  {
    latitude: 37.8750,
    longitude: -122.2580,
    address: 'Bowditch St, Berkeley, CA',
    notes: 'East campus area',
    spotType: 'street' as const,
    spotCount: 5,
  },
  {
    latitude: 37.8690,
    longitude: -122.2640,
    address: 'Allston Way, Berkeley, CA',
    notes: 'Downtown side streets',
    spotType: 'metered' as const,
    spotCount: 10,
  },
];

async function seedBerkeleySpots() {
  console.log('🌱 Seeding Berkeley parking spots...\n');

  if (!db) {
    console.error('❌ Database not configured. Please set DATABASE_URL in .env file.');
    console.error('   Copy .env.example to .env and add your database URL.');
    process.exit(1);
  }

  try {
    let inserted = 0;
    let updated = 0;

    for (const spot of berkeleyParkingSpots) {
      try {
        await db.insert(parkingSlots).values({
          ...spot,
          dataSource: 'user_report',
          verified: true,
          confidenceScore: 90,
          userConfirmations: 0,
          currentlyAvailable: true,
          status: 'available',
        });
        inserted++;
        console.log(`✓ Added: ${spot.address}`);
      } catch (error: any) {
        // If duplicate, that's okay - spot already exists
        if (error.code === '23505') {
          updated++;
        } else {
          console.warn(`⚠️  Failed to add ${spot.address}:`, error.message);
        }
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Seeding complete!`);
    console.log(`➕ New spots added: ${inserted}`);
    console.log(`↻  Spots already existed: ${updated}`);
    console.log(`📍 Total Berkeley spots processed: ${berkeleyParkingSpots.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedBerkeleySpots();
