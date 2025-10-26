import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { db, pool } from '../server/db';
import { parkingSlots } from '../shared/schema';

interface CSVRow {
  LONGITUDE: string;
  LATITUDE: string;
  STREET_NAME: string;
  STREET_NUM: string;
  ACTIVE_METER_FLAG: string;
  METER_TYPE: string;
  PARKING_SPACE_ID: string;
  POST_ID: string;
}

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

async function importCsvData() {
  if (!db || !pool) {
    console.error('❌ Database not configured. Please set DATABASE_URL in .env file.');
    process.exit(1);
  }

  const csvPath = path.join(process.cwd(), 'Parking_Meters_20251025.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found at ${csvPath}`);
    process.exit(1);
  }

  console.log('📊 Reading CSV file...');
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = fileContent.split(/\r?\n/).filter(Boolean);
  
  if (lines.length < 2) {
    console.error('❌ CSV file appears to be empty');
    process.exit(1);
  }

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

  if (lonIdx === -1 || latIdx === -1) {
    console.error('❌ CSV file missing LONGITUDE or LATITUDE columns');
    process.exit(1);
  }

  console.log(`📋 Processing ${lines.length - 1} parking meters...`);

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
      confidenceScore: 85,
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

    // Progress update every 1000 records
    if (spots.length % 1000 === 0) {
      console.log(`  ✓ Processed ${spots.length} spots...`);
    }
  }

  console.log(`\n📊 Total valid spots: ${spots.length}`);
  console.log(`⚠️  Skipped invalid records: ${skipped}`);

  // Check current count
  const beforeResult = await db.select({ id: parkingSlots.id }).from(parkingSlots);
  const beforeCount = beforeResult.length;
  console.log(`\n📊 Current spots in database: ${beforeCount}`);
  
  console.log('\n💾 Inserting parking spots...');
  
  // Insert in batches of 500
  const batchSize = 500;
  let inserted = 0;
  
  for (let i = 0; i < spots.length; i += batchSize) {
    const batch = spots.slice(i, i + batchSize);
    
    try {
      await db.insert(parkingSlots).values(batch);
      inserted += batch.length;
      console.log(`  ✓ Inserted batch ${Math.floor(i / batchSize) + 1} (${inserted}/${spots.length})`);
    } catch (error) {
      console.error(`  ❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
    }
  }

  // Final count
  const afterResult = await db.select({ id: parkingSlots.id }).from(parkingSlots);
  const afterCount = afterResult.length;
  
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║            IMPORT COMPLETE                            ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`📊 Spots before: ${beforeCount}`);
  console.log(`📊 Spots after:  ${afterCount}`);
  console.log(`➕ New spots:    ${afterCount - beforeCount}`);
  console.log('');
  
  await pool.end();
  process.exit(0);
}

importCsvData().catch(error => {
  console.error('❌ Import failed:', error);
  process.exit(1);
});

