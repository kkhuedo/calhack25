# Migration Guide: Two-Tier Parking Spot System

## Overview

This guide will help you migrate your existing ParkSpot database to the new two-tier discovery system with data seeding capabilities.

---

## Prerequisites

Before starting, ensure you have:

- ✅ PostgreSQL database (Neon or local)
- ✅ DATABASE_URL environment variable configured
- ✅ Node.js and npm installed
- ✅ Dependencies installed (`npm install`)

---

## Step-by-Step Migration

### 1. Update Dependencies

First, ensure all dependencies are installed:

```bash
npm install
```

### 2. Backup Your Current Data (IMPORTANT!)

If you have existing parking spots, back them up:

```bash
# Using psql
pg_dump $DATABASE_URL > backup_before_migration.sql

# Or export to JSON (if using a tool like pgAdmin)
```

### 3. Update Database Schema

Push the new schema to your database:

```bash
npm run db:push
```

**What this does:**
- Adds new columns: `spot_type`, `data_source`, `verified`, `confidence_score`
- Adds crowdsource fields: `user_confirmations`, `first_reported_by`, `first_reported_at`
- Adds metadata: `restrictions` (JSONB), `spot_count`
- Adds availability tracking: `currently_available`, `last_updated`

**Schema changes:**
```sql
ALTER TABLE parking_slots
  ADD COLUMN spot_type VARCHAR(50) DEFAULT 'user_discovered',
  ADD COLUMN data_source VARCHAR(50) DEFAULT 'user_report',
  ADD COLUMN verified BOOLEAN DEFAULT false,
  ADD COLUMN confidence_score INTEGER DEFAULT 70,
  ADD COLUMN user_confirmations INTEGER DEFAULT 0,
  ADD COLUMN first_reported_by VARCHAR(255),
  ADD COLUMN first_reported_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN restrictions JSONB,
  ADD COLUMN spot_count INTEGER DEFAULT 1,
  ADD COLUMN currently_available BOOLEAN DEFAULT true,
  ADD COLUMN last_updated TIMESTAMP DEFAULT NOW();
```

### 4. Migrate Existing Data (Optional)

If you have existing parking spots, mark them as user-discovered:

```sql
-- Update all existing spots to be unverified user reports
UPDATE parking_slots
SET
  spot_type = 'user_discovered',
  data_source = 'user_report',
  verified = false,
  confidence_score = 70,
  user_confirmations = 1,
  currently_available = (status = 'available'),
  spot_count = 1
WHERE spot_type IS NULL; -- Only update rows without the new fields
```

Or mark them as verified (if they're from a trusted source):

```sql
-- If your existing data is from a trusted source
UPDATE parking_slots
SET
  spot_type = 'street', -- or 'metered', 'public_lot', etc.
  data_source = 'legacy_data',
  verified = true,
  confidence_score = 95,
  user_confirmations = 3,
  currently_available = (status = 'available'),
  spot_count = 1
WHERE spot_type IS NULL;
```

### 5. Seed Verified Parking Data

Now seed your database with official parking data:

```bash
npm run seed
```

This will add thousands of verified parking spots from:
- San Francisco Open Data (parking meters)
- OpenStreetMap (parking lots and areas)
- Google Places (if API key is configured)

### 6. Switch to Database Storage

If you were using in-memory storage, switch to database storage:

**File:** `server/storage.ts` (line 234)

```typescript
// BEFORE
export const storage = new MemoryStorage();

// AFTER
export const storage = new DatabaseStorage();
```

### 7. Restart Your Server

```bash
npm run dev
```

### 8. Verify the Migration

Check that everything is working:

```bash
# 1. Check database connection
curl http://localhost:5000/health

# 2. Check parking slots
curl http://localhost:5000/api/parking-slots

# 3. Count spots by type
psql $DATABASE_URL -c "SELECT spot_type, verified, COUNT(*) FROM parking_slots GROUP BY spot_type, verified;"
```

Expected output:
```
    spot_type    | verified | count
-----------------+----------+-------
 metered         | t        |  4832
 street          | t        |   156
 user_discovered | f        |    12
(3 rows)
```

---

## Breaking Changes

### API Changes

**New Endpoints:**
```
POST /api/parking-slots/report
POST /api/parking-slots/:id/confirm
```

**Updated Fields:**
- `status` - Legacy field (kept for backward compatibility)
- `currentlyAvailable` - New field for real-time availability
- `verified` - Indicates if spot is from official source
- `confidenceScore` - 0-100 score
- `userConfirmations` - Number of users who confirmed this spot

**Client Changes:**
The frontend now displays:
- Green markers for verified spots
- Orange markers for unverified spots
- Confidence scores in info cards
- "Confirm Spot" button for unverified spots

---

## Rollback Procedure

If you need to rollback:

### 1. Restore Database Backup

```bash
psql $DATABASE_URL < backup_before_migration.sql
```

### 2. Revert Code Changes

```bash
git checkout HEAD~1 shared/schema.ts
git checkout HEAD~1 server/storage.ts
git checkout HEAD~1 server/routes.ts
git checkout HEAD~1 client/src/components/ParkingMap.tsx
```

### 3. Remove New Files

```bash
rm server/geo-utils.ts
rm scripts/seed-parking-data.ts
rm DATA_SEEDING.md
rm MIGRATION_GUIDE.md
```

---

## Post-Migration Checklist

- [ ] Database schema updated successfully
- [ ] Existing data migrated (if applicable)
- [ ] Seeding script executed successfully
- [ ] Server restarted and running
- [ ] Health check passes
- [ ] API returns parking slots
- [ ] Frontend displays verified/unverified markers
- [ ] "Confirm Spot" button appears for unverified spots
- [ ] New spot discovery works (test by reporting at new location)

---

## Troubleshooting

### "Cannot find module '@shared/schema'"

**Solution:** Restart your dev server
```bash
npm run dev
```

### "Database not configured"

**Solution:** Check your `.env` file has `DATABASE_URL` set

### "CORS error in browser"

**Solution:** The server and client should run on the same port in dev mode (handled by Vite proxy)

### Markers don't appear on map

**Solution:**
1. Check browser console for errors
2. Verify database has parking slots: `curl http://localhost:5000/api/parking-slots`
3. Check if slots have valid lat/lon coordinates

---

## Support

For issues or questions:
1. Check `DATA_SEEDING.md` for usage documentation
2. Review the error logs in your terminal
3. Check database connection: `npm run health`

---

## Next Steps

After successful migration:

1. **Test the Discovery Flow:**
   - Open the app in two browsers
   - Report a new parking spot in one
   - Confirm it in the other
   - Watch it become verified after 3 confirmations

2. **Customize Seeding:**
   - Edit `scripts/seed-parking-data.ts` to add more cities
   - Adjust the limits (currently 5000 meters)

3. **Add Authentication:**
   - Track which users discovered spots
   - Prevent duplicate confirmations by the same user
   - Implement a points/reputation system

4. **Deploy to Production:**
   - Ensure DATABASE_URL is set in production
   - Run seeding script on production database
   - Switch to DatabaseStorage in production build

Enjoy your new two-tier parking discovery system! 🚗
