import { db } from './server/db';
import { parkingSlots } from './shared/schema';
import { sql } from 'drizzle-orm';

async function testDatabase() {
  try {
    // Check if database is configured
    if (!db) {
      console.error('❌ Database connection failed: DATABASE_URL not configured');
      console.log('Please set DATABASE_URL environment variable');
      process.exit(1);
    }

    console.log('🔍 Testing database connection...');

    // Query the parking_spots table
    const result = await db.select({ count: sql<number>`count(*)` }).from(parkingSlots);
    const spotCount = Number(result[0].count);

    console.log('✅ Database connection successful!');
    console.log(`📊 Total parking spots in database: ${spotCount}`);

  } catch (error) {
    console.error('❌ Database connection failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    process.exit(1);
  }
}

testDatabase();
