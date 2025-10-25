// Quick database connection test
import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in .env file');
  process.exit(1);
}

console.log('🔌 Testing database connection...\n');

const pool = new Pool({ connectionString: DATABASE_URL });

try {
  // Test connection
  const result = await pool.query('SELECT version()');
  console.log('✅ Database connected successfully!');
  console.log('📊 PostgreSQL version:', result.rows[0].version);

  // Test parking_slots table
  const tableCheck = await pool.query(`
    SELECT COUNT(*) as count
    FROM parking_slots
  `);
  console.log('✅ parking_slots table exists');
  console.log('📍 Current parking spots:', tableCheck.rows[0].count);

  console.log('\n🎉 Database is ready to use!\n');

} catch (error) {
  console.error('❌ Database connection failed:', error.message);
  console.log('\n💡 Make sure you:');
  console.log('   1. Created a Neon database at https://neon.tech');
  console.log('   2. Updated DATABASE_URL in .env file');
  console.log('   3. Ran: npm run db:push\n');
} finally {
  await pool.end();
}
