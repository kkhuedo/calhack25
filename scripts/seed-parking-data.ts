/**
 * Database Seeding Script
 *
 * Populates the database with known parking spots from official data sources
 *
 * Usage:
 *   npm run seed:parking -- --preview       # Test with 100 spots
 *   npm run seed:parking -- --meters        # Only meters
 *   npm run seed:parking -- --census        # Only census
 *   npm run seed:parking -- --citations     # Only citations
 *   npm run seed:parking                    # Full ingestion (all sources)
 */

import { dataIngestionOrchestrator } from "../server/services/data-ingestion/orchestrator.service";
import { db } from "../server/db";
import { parkingSpots, dataIngestionLogs } from "../shared/schema-v2";
import type { InsertParkingSpot } from "../shared/schema-v2";

// Parse command line arguments
const args = process.argv.slice(2);
const isPreview = args.includes('--preview');
const onlyMeters = args.includes('--meters');
const onlyCensus = args.includes('--census');
const onlyCitations = args.includes('--citations');

async function seedDatabase() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   🅿️  PARKSHARE DATABASE SEEDING                      ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('\n');

  // Check database connection
  try {
    console.log('🔌 Checking database connection...');
    await db.select().from(parkingSpots).limit(1);
    console.log('✅ Database connected\n');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    console.error('\n💡 Make sure:');
    console.error('   1. PostgreSQL is running');
    console.error('   2. DATABASE_URL is set in .env');
    console.error('   3. Schema is created: npm run db:push\n');
    process.exit(1);
  }

  // Start ingestion log
  const logId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    await db.insert(dataIngestionLogs).values({
      id: logId,
      source: 'orchestrator',
      status: 'started',
      metadata: {
        options: {
          preview: isPreview,
          onlyMeters,
          onlyCensus,
          onlyCitations,
        },
      },
      startedAt: new Date(),
    });
  } catch (error) {
    console.warn('⚠️  Could not create ingestion log (table might not exist yet)');
  }

  let result;

  try {
    // Run ingestion
    if (isPreview) {
      console.log('🔍 Running in PREVIEW mode (100 spots max)\n');
      result = await dataIngestionOrchestrator.previewIngestion(100);
    } else {
      const options = {
        includeCensus: !onlyMeters && !onlyCitations,
        includeMeters: !onlyCensus && !onlyCitations,
        includeCitations: !onlyCensus && !onlyMeters,
      };

      result = await dataIngestionOrchestrator.ingestAll(options);
    }

    // Insert spots into database
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  INSERTING SPOTS INTO DATABASE');
    console.log('═══════════════════════════════════════════════════════\n');

    const batchSize = 500;
    const spots = result.spots;
    let inserted = 0;

    for (let i = 0; i < spots.length; i += batchSize) {
      const batch = spots.slice(i, i + batchSize);

      try {
        await db.insert(parkingSpots).values(batch);
        inserted += batch.length;
        console.log(`💾 Inserted ${inserted.toLocaleString()} / ${spots.length.toLocaleString()} spots...`);
      } catch (error: any) {
        // Handle duplicate key errors gracefully
        if (error.code === '23505') { // PostgreSQL duplicate key error
          console.warn(`⚠️  Batch ${i / batchSize + 1} contains duplicates, skipping...`);
        } else {
          throw error;
        }
      }
    }

    // Update ingestion log
    try {
      await db.update(dataIngestionLogs)
        .set({
          status: 'completed',
          recordsProcessed: result.totalSpots,
          recordsCreated: inserted,
          recordsSkipped: result.duplicatesRemoved,
          completedAt: new Date(),
        })
        .where(db => db.id === logId);
    } catch (error) {
      // Ignore if table doesn't exist
    }

    // Final summary
    console.log('\n');
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║              ✅ SEEDING COMPLETE!                      ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`💾 Spots Inserted:        ${inserted.toLocaleString()}`);
    console.log(`⏱️  Total Duration:        ${(result.duration / 1000).toFixed(1)}s`);
    console.log('');

    if (result.errors.length > 0) {
      console.log('⚠️  Some sources failed:');
      result.errors.forEach(err => console.log(`   - ${err}`));
      console.log('');
    }

    console.log('🎉 Your database now has known parking spot locations!');
    console.log('🚀 Users can now just update availability instead of creating spots\n');

  } catch (error: any) {
    console.error('\n❌ Seeding failed:', error.message);
    console.error(error.stack);

    // Update log
    try {
      await db.update(dataIngestionLogs)
        .set({
          status: 'failed',
          errorMessage: error.message,
          completedAt: new Date(),
        })
        .where(db => db.id === logId);
    } catch {
      // Ignore
    }

    process.exit(1);
  }
}

// Run the seeding
seedDatabase().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
