/**
 * Debug script to check what's in storage
 * Run this while the dev server is running
 */
import 'dotenv/config';
import { storage } from './server/storage';

async function debugStorage() {
  console.log('\n🔍 Debugging Parking Slot Storage\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const slots = await storage.getParkingSlots();

  console.log(`📊 Total slots in storage: ${slots.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (slots.length === 0) {
    console.log('❌ No slots found in storage!');
    console.log('   This is why nothing shows on the map.\n');
    console.log('💡 Solutions:');
    console.log('   1. Add slots via UI (click + button)');
    console.log('   2. Run: npm run seed:berkeley (if database connected)');
    console.log('   3. Check if DATABASE_URL is set in .env\n');
  } else {
    console.log('📍 Parking Slots:\n');

    const available = slots.filter(s => s.status === 'available' || s.currentlyAvailable);
    const taken = slots.filter(s => s.status !== 'available' && !s.currentlyAvailable);

    console.log(`✅ Available: ${available.length}`);
    console.log(`❌ Taken: ${taken.length}\n`);

    slots.forEach((slot, idx) => {
      const statusIcon = (slot.status === 'available' || slot.currentlyAvailable) ? '🟢' : '🔴';
      const verifiedIcon = slot.verified ? '✓' : '?';
      console.log(`${idx + 1}. ${statusIcon} ${verifiedIcon} ${slot.address}`);
      console.log(`   Lat: ${slot.latitude}, Lon: ${slot.longitude}`);
      console.log(`   Status: ${slot.status}, Available: ${slot.currentlyAvailable}`);
      console.log(`   ID: ${slot.id}\n`);
    });

    if (available.length === 0) {
      console.log('⚠️  Warning: No available slots!');
      console.log('   The frontend only shows "available" slots.');
      console.log('   All your slots are marked as "taken".\n');
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

debugStorage().catch(console.error);
