import 'dotenv/config';
import { db, pool } from '../server/db';
import { parkingSlots } from '../shared/schema';
import fs from 'fs';
import path from 'path';

/**
 * Import parking data from all FREE sources:
 * 1. CSV file (38k+ SF parking meters)
 * 2. OpenStreetMap (parking lots/garages)
 */

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function importCsvMeters() {
  console.log('\n📊 [1/2] Importing CSV Parking Meters...\n');
  
  if (!db || !pool) {
    console.error('❌ Database not configured');
    return 0;
  }

  const csvPath = path.join(process.cwd(), 'Parking_Meters_20251025.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.warn('⚠️  CSV file not found, skipping...');
    return 0;
  }

  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = fileContent.split(/\r?\n/).filter(Boolean);
  
  if (lines.length < 2) return 0;

  const header = parseCsvLine(lines[0]);
  const idxOf = (name: string) => header.findIndex(h => h.toUpperCase() === name.toUpperCase());
  
  const lonIdx = idxOf('LONGITUDE');
  const latIdx = idxOf('LATITUDE');
  const streetIdx = idxOf('STREET_NAME');
  const numIdx = idxOf('STREET_NUM');
  const spaceIdIdx = idxOf('PARKING_SPACE_ID');
  const postIdIdx = idxOf('POST_ID');
  const activeFlagIdx = idxOf('ACTIVE_METER_FLAG');
  const meterTypeIdx = idxOf('METER_TYPE');

  const spots: any[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const lon = parseFloat(row[lonIdx] || '');
    const lat = parseFloat(row[latIdx] || '');
    
    if (isNaN(lat) || isNaN(lon)) {
      skipped++;
      continue;
    }

    const street = (row[streetIdx] || '').trim();
    const num = (row[numIdx] || '').trim();
    const address = [num, street, 'San Francisco, CA'].filter(Boolean).join(' ');

    const sourceId = (row[spaceIdIdx] || row[postIdIdx] || `meter_${i}`).toString();
    const activeFlag = (row[activeFlagIdx] || '').toString();
    const meterType = (row[meterTypeIdx] || '').toString();

    spots.push({
      latitude: lat,
      longitude: lon,
      address,
      spotType: activeFlag === 'ON' || activeFlag === 'U' ? 'metered' : 'street',
      dataSource: 'sf_open_data',
      verified: true,
      confidenceScore: 90,
      userConfirmations: 0,
      firstReportedBy: null,
      restrictions: {
        meterType: meterType || undefined,
        activeFlag: activeFlag,
      },
      spotCount: 1,
      currentlyAvailable: true,
      status: 'available',
    });

    if (spots.length % 5000 === 0) {
      console.log(`  ✓ Processed ${spots.length} spots...`);
    }
  }

  console.log(`  ✓ Total valid spots: ${spots.length}`);
  console.log(`  ⚠️  Skipped invalid: ${skipped}`);

  // Insert in batches
  const batchSize = 500;
  let inserted = 0;
  
  for (let i = 0; i < spots.length; i += batchSize) {
    const batch = spots.slice(i, i + batchSize);
    try {
      await db!.insert(parkingSlots).values(batch);
      inserted += batch.length;
      if (inserted % 5000 === 0) {
        console.log(`  ✓ Inserted ${inserted} spots...`);
      }
    } catch (error) {
      console.error(`  ❌ Error at batch ${i}:`, error);
    }
  }

  console.log(`\n✅ Imported ${inserted} CSV parking meters\n`);
  return inserted;
}

async function importOpenStreetMap() {
  console.log('🗺️  [2/2] Importing OpenStreetMap parking data...\n');
  
  if (!db || !pool) {
    console.error('❌ Database not configured');
    return 0;
  }

  try {
    // SF bounding box
    const bbox = '-122.5178,37.7874,-122.3484,37.8117';
    
    const url = `https://overpass-api.de/api/interpreter?data=[out:json];(way["amenity"="parking"](bbox);node["amenity"="parking"](bbox);way["highway"="parking_lane"](bbox););out geom;`;
    
    console.log('  📡 Fetching OpenStreetMap data...');
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000)
    });
    
    if (!response.ok) {
      console.warn(`  ⚠️  OSM API returned ${response.status}`);
      return 0;
    }

    const data = await response.json();
    const elements = data.elements || [];
    
    console.log(`  ✓ Found ${elements.length} parking areas from OSM`);

    let inserted = 0;
    const batch: any[] = [];

    for (const element of elements) {
      let lat: number | undefined;
      let lon: number | undefined;

      if (element.type === 'node') {
        lat = element.lat;
        lon = element.lon;
      } else if (element.center) {
        lat = element.center.lat;
        lon = element.center.lon;
      }

      if (!lat || !lon) continue;

      const address = element.tags?.name || 'Parking Area';
      const spotType = element.tags?.parking || 'public_lot';
      
      batch.push({
        latitude: lat,
        longitude: lon,
        address,
        spotType,
        dataSource: 'openstreetmap',
        verified: true,
        confidenceScore: 80,
        userConfirmations: 0,
        firstReportedBy: null,
        restrictions: {
          fee: element.tags?.fee,
          surface: element.tags?.surface,
          capacity: element.tags?.capacity,
        },
        spotCount: parseInt(element.tags?.capacity) || 1,
        currentlyAvailable: true,
        status: 'available',
      });

      if (batch.length >= 100) {
        try {
          await db!.insert(parkingSlots).values(batch);
          inserted += batch.length;
          console.log(`  ✓ Inserted ${inserted} OSM spots...`);
          batch.length = 0;
        } catch (error) {
          console.error(`  ❌ Error inserting OSM batch:`, error);
        }
      }
    }

    // Insert remaining
    if (batch.length > 0) {
      try {
        await db!.insert(parkingSlots).values(batch);
        inserted += batch.length;
      } catch (error) {
        console.error(`  ❌ Error inserting final OSM batch:`, error);
      }
    }

    console.log(`\n✅ Imported ${inserted} OpenStreetMap parking spots\n`);
    return inserted;
  } catch (error) {
    console.error('  ❌ Error fetching OpenStreetMap data:', error);
    return 0;
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  PARKSARE - Import All FREE Data Sources              ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  
  if (!db || !pool) {
    console.error('❌ Database not configured. Please set DATABASE_URL in .env file.');
    process.exit(1);
  }

  const beforeResult = await db.select({ id: parkingSlots.id }).from(parkingSlots);
  const beforeCount = beforeResult.length;
  console.log(`\n📊 Current spots: ${beforeCount}\n`);

  let totalInserted = 0;

  // Import CSV
  totalInserted += await importCsvMeters();

  // Import OSM
  totalInserted += await importOpenStreetMap();

  // Final count
  const afterResult = await db.select({ id: parkingSlots.id }).from(parkingSlots);
  const afterCount = afterResult.length;

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                  IMPORT COMPLETE                        ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`📊 Spots before:  ${beforeCount}`);
  console.log(`📊 Spots after:   ${afterCount}`);
  console.log(`➕ New spots:     ${afterCount - beforeCount}`);
  console.log('');

  await pool.end();
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Import failed:', error);
  process.exit(1);
});

