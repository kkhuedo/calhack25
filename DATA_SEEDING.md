# ParkSpot - Data Seeding & Two-Tier Spot Discovery System

## Overview

ParkSpot uses a **two-tier parking spot discovery system** to provide the best parking experience:

- **TIER 1: Verified Spots** - Official parking data from city databases, Google Places, and OpenStreetMap
- **TIER 2: Crowdsourced Spots** - User-discovered locations that get verified through community confirmations

---

## Quick Start

### 1. Database Setup

First, ensure your database is configured:

```bash
# Copy environment variables
cp .env.example .env

# Edit .env and set your DATABASE_URL
# DATABASE_URL=postgresql://user:password@host:port/database
```

Push the updated schema to your database:

```bash
npm run db:push
```

### 2. Run Data Seeding

Seed your database with verified parking spots from multiple sources:

```bash
npm run seed
```

This will:
- ✅ Fetch ~5,000 parking meters from San Francisco Open Data
- ✅ Fetch parking lots/garages from OpenStreetMap
- 🔑 (Optional) Fetch parking lots from Google Places API

**Expected output:**
```
🌱 Starting parking data seeding...

📊 Current spots in database: 0

🚗 Fetching SF parking meters from Open Data API...
📊 Found 4,832 active parking meters
  ✓ Inserted 100 meters...
  ✓ Inserted 200 meters...
  ...
✅ Successfully seeded 4,832 SF parking meters

🗺️ Fetching parking from OpenStreetMap...
📊 Found 156 parking areas from OSM
✅ Successfully seeded 156 parking areas from OSM

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Seeding complete!
📊 Total spots in database: 4,988
➕ New spots added: 4,988
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Data Sources

### 1. San Francisco Open Data (FREE)

**Source:** [SF Parking Meters Dataset](https://data.sfgov.org/resource/8vzz-qzz9.json)

**What it provides:**
- 30,000+ metered parking spaces
- Location coordinates
- Meter color (cap color)
- Smart meter status
- Active/inactive status

**Coverage:** San Francisco only

**No API key required!**

---

### 2. OpenStreetMap (FREE)

**Source:** [Overpass API](https://overpass-api.de/)

**What it provides:**
- Parking lots and garages
- Street parking areas
- Capacity information
- Fee information (paid/free)
- Surface type

**Coverage:** Worldwide

**No API key required!**

---

### 3. Google Places API (OPTIONAL - Paid)

**Setup:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project
3. Enable Places API
4. Create an API key
5. Add to `.env`:
   ```bash
   GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

**Free Tier:** $200 credit/month (≈ 6,250 free requests/month)

**What it provides:**
- Parking lots and garages
- Real-time popularity data
- User ratings and reviews
- Opening hours

**Coverage:** Worldwide

---

## Two-Tier Discovery System

### How It Works

#### TIER 1: Verified Spots (Official Data)

When a spot is seeded from official sources:
```javascript
{
  spotType: "metered" | "public_lot" | "garage" | "street",
  dataSource: "sf_open_data" | "google_places" | "openstreetmap",
  verified: true,
  confidenceScore: 95-98,
  markerColor: "green" // with checkmark icon
}
```

#### TIER 2: User-Discovered Spots

**Scenario 1: User reports parking at NEW location (no spot within 20m)**

```javascript
// User taps "I Parked Here" at unknown location
POST /api/parking-slots/report
{
  latitude: 37.8716,
  longitude: -122.2727,
  status: "available"
}

// System creates new spot
{
  spotType: "user_discovered",
  dataSource: "user_report",
  verified: false,
  confidenceScore: 70,
  userConfirmations: 1,
  markerColor: "orange" // with question mark icon
}
```

**Scenario 2: Another user confirms the spot**

```javascript
// Different user parks at same location (within 20m)
POST /api/parking-slots/report
// or
POST /api/parking-slots/:id/confirm

// System increments confirmations
{
  userConfirmations: 2 // → Shows "2/3 confirmations"
}

// After 3+ confirmations → automatically verified!
{
  verified: true,
  confidenceScore: 95,
  markerColor: "green" // upgraded to verified
}
```

---

## API Endpoints

### Report Parking (Two-Tier Logic)

```bash
POST /api/parking-slots/report

Body:
{
  "latitude": 37.8716,
  "longitude": -122.2727,
  "status": "available" | "taken",
  "userId": "optional-user-id"
}

Response (New Discovery):
{
  "spot": { ... },
  "isNewDiscovery": true,
  "message": "New parking spot discovered!",
  "pointsEarned": 20
}

Response (Existing Spot Update):
{
  "spot": { ... },
  "isNewDiscovery": false,
  "distance": 12.5,
  "message": "Spot status updated"
}
```

### Confirm Spot

```bash
POST /api/parking-slots/:id/confirm

Body:
{
  "userId": "optional-user-id"
}

Response:
{
  "spot": { ... },
  "message": "Spot confirmed (2/3 confirmations)"
}
```

---

## Visual Indicators

### Map Markers

| Color | Icon | Meaning |
|-------|------|---------|
| 🟢 Green | ✓ Checkmark | Verified & Available |
| 🟠 Orange | ? Question Mark | Unverified & Available (user-discovered) |
| 🔴 Red | Empty | Occupied/Taken |

### Info Card Badges

**Verified Spot:**
```
✓ Verified
Confidence: 98%
```

**Unverified Spot:**
```
! Unverified (2/3 confirmations)
Confidence: 70%
[Confirm Spot Button]
```

---

## Database Schema

### New Fields Added

```typescript
{
  // Two-tier system fields
  spotType: "metered" | "public_lot" | "garage" | "street" | "user_discovered",
  dataSource: "sf_open_data" | "google_places" | "openstreetmap" | "user_report",
  verified: boolean,
  confidenceScore: number, // 0-100

  // Crowdsourced validation
  userConfirmations: number, // How many users confirmed
  firstReportedBy: string | null, // User ID who discovered
  firstReportedAt: timestamp,

  // Metadata
  restrictions: {
    meterColor?: string,
    smartMeter?: boolean,
    fee?: boolean,
    surface?: string
  },
  spotCount: number, // How many spots at this location

  // Current availability
  currentlyAvailable: boolean,
  lastUpdated: timestamp
}
```

---

## Configuration

### Switch Between Memory and Database Storage

**Development (in-memory):**
```typescript
// server/storage.ts
export const storage = new MemoryStorage(); // ✅ Currently active
```

**Production (PostgreSQL):**
```typescript
// server/storage.ts
export const storage = new DatabaseStorage();
```

### Adjust Discovery Radius

**Default: 20 meters**

To change the radius for detecting nearby spots:

```typescript
// server/geo-utils.ts
export function findClosestSpot(
  latitude: number,
  longitude: number,
  spots: T[],
  maxDistanceMeters: number = 20 // ← Change this value
)
```

---

## Troubleshooting

### Seeding Fails with Database Error

**Problem:**
```
❌ Database not configured. Please set DATABASE_URL environment variable.
```

**Solution:**
1. Create `.env` file from `.env.example`
2. Set valid `DATABASE_URL`
3. Run `npm run db:push` to create schema
4. Run `npm run seed` again

---

### Google Places API Returns 403

**Problem:**
```
⚠️ Google Places API error for SF Downtown: REQUEST_DENIED
```

**Solution:**
1. Ensure Places API is enabled in Google Cloud Console
2. Check API key restrictions (HTTP referrers, IP addresses)
3. Verify billing is enabled (free tier requires billing account)

---

### Too Many Duplicate Spots

**Problem:** Multiple spots created for same location

**Solution:** Adjust the discovery radius (increase from 20m to 30m or 50m):

```typescript
// server/storage.ts - line 76 & 176
const nearby = findClosestSpot(latitude, longitude, allSlots, 30); // Increase from 20
```

---

## Next Steps

1. **Add Authentication** - Track which users discovered/confirmed spots
2. **Points System** - Reward users for discoveries and confirmations
3. **Add More Cities** - Extend seeding script to LA, NYC, etc.
4. **Real-time Updates** - WebSocket broadcasts already implemented!
5. **Mobile App** - Use the same API for iOS/Android

---

## File Locations

| Feature | File |
|---------|------|
| Database Schema | `shared/schema.ts` |
| Seeding Script | `scripts/seed-parking-data.ts` |
| Storage Logic | `server/storage.ts` |
| API Routes | `server/routes.ts` |
| Geo Utilities | `server/geo-utils.ts` |
| Map Component | `client/src/components/ParkingMap.tsx` |

---

## License

MIT
