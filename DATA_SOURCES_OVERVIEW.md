# ParkShare - Available Data Sources

## Current Status
- **Database**: 2 user-created spots
- **CSV Ready**: 38,234 SF parking meters (12MB file available)

## Available Free Data Sources

### 1. ✅ CSV Parking Meters (READY TO USE)
**File**: `Parking_Meters_20251025.csv` (12MB, 38,234 meters)
- **Source**: San Francisco Municipal Transportation Agency (SFMTA)
- **Data**: Official SF parking meters with coordinates
- **Status**: Script ready (`npm run import:csv`)
- **Free**: Yes
- **Accuracy**: Official city data
- **Effort**: Run import script

### 2. 🌐 OpenStreetMap (Free - No API Key)
**Source**: OpenStreetMap Overpass API
- **Data**: Parking lots, garages, curb parking worldwide
- **Already in code**: `scripts/seed-parking-data.ts` (seedOSMParking function)
- **Free**: Yes
- **Accuracy**: Community-maintained, good coverage
- **Effort**: Enable in seed script

### 3. 🏛️ SF Open Data API (Free)
**Source**: data.sfgov.org
- **Data**: Real-time parking meter data
- **Already in code**: `scripts/seed-parking-data.ts` (seedSFParkingMeters function)
- **Free**: Yes
- **Accuracy**: Official city data
- **Effort**: Run seed script

### 4. 🔑 Google Places API (Optional - Paid)
**Source**: Google Maps Platform
- **Data**: Parking lots, garages, businesses with parking
- **Already in code**: `scripts/seed-parking-data.ts` (seedGooglePlaces function)
- **Free**: No ($5-10 credit/month, then pay-per-use)
- **Accuracy**: High quality, comprehensive
- **Effort**: Add API key to `.env`
- **Cost**: ~$0.02 per API call

### 5. 📍 SF Parking Citations Data (Suggested - Free)
**Source**: data.sfgov.org
- **Data**: Parking citation locations (shows where people parked)
- **Free**: Yes
- **Accuracy**: Shows actual parking patterns
- **Effort**: New script needed

### 6. 🚗 SF Real-Time Parking API (Suggested - Free)
**Source**: SF Open Data
- **Data**: Real-time availability of parking spots
- **Free**: Yes
- **Accuracy**: Real-time, very accurate
- **Effort**: New script needed
- **Note**: Would require ongoing sync

## Recommended Action Plan

### Priority 1: Import CSV Data (5 minutes)
```bash
# This will add 38,000+ verified parking spots
npm run import:csv
```

### Priority 2: Enable OpenStreetMap (2 minutes)
Edit `scripts/seed-parking-data.ts` line 308:
```typescript
// Currently commented out
// totalSeeded += await seedOSMParking();

// Uncomment to enable:
totalSeeded += await seedOSMParking();
```

Then run:
```bash
npm run seed
```

### Priority 3: Add Google Places (if budget allows)
1. Get API key from Google Cloud Console
2. Add to `.env`:
   ```
   GOOGLE_MAPS_API_KEY=your_key_here
   ```
3. Run `npm run seed`

### Priority 4: New Custom Scripts (Future)
- SF Parking Citations integration
- Real-time parking availability sync
- Curated parking hotspots

## Expected Results

### After Priority 1 (CSV Import)
- **Spots**: 38,000+ SF parking meters
- **Coverage**: All of San Francisco
- **Time**: ~5 minutes import

### After Priority 2 (Add OpenStreetMap)
- **Spots**: 50,000+ (meters + lots + garages)
- **Coverage**: SF + Bay Area
- **Time**: ~10 minutes import

### After Priority 3 (Add Google Places)
- **Spots**: 60,000+ 
- **Coverage**: SF + Bay Area + businesses
- **Time**: ~15 minutes import
- **Cost**: ~$0.50-2.00 one-time

## Current Limitations
- Database currently has only 2 test spots
- CSV file has 38,234 spots ready to import
- Other sources configured but not enabled

