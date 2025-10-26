# 🌱 Parking Data Seeding Guide

Comprehensive guide for seeding your ParkShare database with parking spot data from multiple sources.

## 📊 Data Sources

The enhanced seeding script pulls parking data from **4 different sources**:

### 1. **SF Open Data** (Parking Meters)
- **Type**: Official parking meters
- **Coverage**: San Francisco
- **API**: Free, no key required
- **Reliability**: ⭐⭐⭐⭐⭐ (Most reliable)
- **Data Quality**: Individual metered parking spots with precise locations

### 2. **SF Parking Regulations CSV**
- **Type**: Street segments with parking rules
- **Coverage**: San Francisco
- **Source**: SF Municipal Transportation Agency (SFMTA)
- **Reliability**: ⭐⭐⭐⭐⭐ (Official data)
- **Data Quality**: Street-level parking with time limits, permit zones, and restrictions

### 3. **Google Places API**
- **Type**: Parking lots and garages
- **Coverage**: SF Bay Area (Berkeley, Oakland, SF, Peninsula)
- **API**: Requires API key
- **Reliability**: ⭐⭐⭐⭐ (High quality, commercial data)
- **Data Quality**: Named parking facilities with ratings and capacity

### 4. **OpenStreetMap**
- **Type**: Community-contributed parking areas
- **Coverage**: SF Bay Area
- **API**: Free, no key required
- **Reliability**: ⭐⭐⭐ (Varies by area)
- **Data Quality**: Comprehensive coverage, including capacity and fee information

---

## 🚀 Quick Start

### Basic Seeding (Free - No API Keys)

```bash
npm run seed
```

This will fetch data from:
- ✅ SF Open Data (parking meters)
- ❌ SF Parking Regulations (CSV not provided)
- ✅ Google Places (using your API key)
- ✅ OpenStreetMap (free)

### Full Seeding (With All Sources)

```bash
# 1. Set environment variables
export GOOGLE_MAPS_API_KEY="your-api-key-here"
export SF_PARKING_CSV_PATH="/path/to/Parking_regulations_20251025.csv"

# 2. Run seeding
npm run seed
```

---

## 🔑 Setup Instructions

### Google Maps API Key

1. **Get your API key**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Enable **Places API**
   - Create credentials (API Key)
   - **Your API key**: `AIzaSyDSRPi7RAKkm3P79zjsxPqiOVFtOwUgzxM`

2. **Set environment variable**:
   ```bash
   # In your .env file
   GOOGLE_MAPS_API_KEY=AIzaSyDSRPi7RAKkm3P79zjsxPqiOVFtOwUgzxM
   ```

3. **Cost estimate**:
   - Places API Nearby Search: $32 per 1,000 requests
   - Our script searches ~25 locations = ~$0.80 per run
   - First $200/month is FREE

### SF Parking Regulations CSV

1. **Download the CSV**:
   - File: `Parking_regulations_(except_non-metered_color_curb)_20251025.csv`
   - Place it in your project root or any location

2. **Set the path**:
   ```bash
   # In your .env file
   SF_PARKING_CSV_PATH=/path/to/Parking_regulations_20251025.csv
   ```

---

## 📈 Expected Results

### Data Volume by Source

| Source | Typical Count | Type |
|--------|---------------|------|
| SF Open Data | 4,000-5,000 | Individual meters |
| SF Regulations CSV | 6,000-8,000 | Street segments |
| Google Places | 500-1,000 | Parking lots/garages |
| OpenStreetMap | 200-500 | Community parking areas |
| **TOTAL** | **~12,000-15,000** | **Mixed** |

### Example Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌱 PARKING DATA SEEDING - ENHANCED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Current spots in database: 0

━━━ SOURCE 1: SF OPEN DATA (PARKING METERS) ━━━
🚗 Fetching SF parking meters from Open Data API...
📊 Found 5000 active parking meters
  ✓ Inserted 100 meters...
  ✓ Inserted 200 meters...
  ...
✅ Successfully seeded 4856 SF parking meters

━━━ SOURCE 2: SF PARKING REGULATIONS CSV ━━━
📄 Reading SF parking regulations CSV from: /path/to/csv
📊 Found 7783 parking regulation records
✅ Parsed 6891 parking spots
  ✓ Inserted 100 spots...
  ✓ Inserted 200 spots...
  ...
✅ Successfully seeded 6891 parking segments from SF regulations

━━━ SOURCE 3: GOOGLE PLACES API ━━━
🅿️  Fetching parking from Google Places API...
📍 Searching 25 locations with 2000m radius

[1/25] SF Financial District
  🔍 Searching SF Financial District...
  ✓ Found 20 spots
  ✓ Page 2: +20 spots (total: 40)
  📊 Total unique spots: 40

[2/25] SF Union Square
  ...

✅ Completed Google Places fetch: 847 unique parking spots
✅ Successfully seeded 847 parking lots from Google Places

━━━ SOURCE 4: OPENSTREETMAP (OVERPASS API) ━━━
🗺️  Fetching parking from OpenStreetMap...
📍 Querying 3 regions

[1/3] San Francisco
  🗺️  Fetching San Francisco...
  ✓ Found 156 parking areas
  📊 Total unique spots: 156

[2/3] Berkeley/Oakland
  ...

✅ Completed OSM fetch: 324 parking spots
✅ Successfully seeded 324 parking areas from OSM

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SEEDING COMPLETE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Total spots in database: 12,918
➕ New spots added: 12,918

📈 Breakdown by source:
   SF Parking Meters: 4,856 spots
   SF Parking Regulations: 6,891 spots
   Google Places: 847 spots
   OpenStreetMap: 324 spots
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Tips:
   - Run this script periodically to keep data fresh
   - Set GOOGLE_MAPS_API_KEY for parking lot/garage data
   - Set SF_PARKING_CSV_PATH for street segment data
   - OSM data is free and updates automatically
```

---

## 🛠️ Advanced Usage

### Customize Search Areas

Edit `scripts/fetchers/google-places.ts` to add more locations:

```typescript
export const SF_BAY_AREA_GRID = [
  // Add your custom locations
  { lat: 37.7749, lon: -122.4194, name: 'My Neighborhood' },
  // ...
];
```

### Filter by Data Source

Query only specific data sources in your app:

```typescript
const spots = await db
  .select()
  .from(parkingSlots)
  .where(eq(parkingSlots.dataSource, 'google_places'));
```

### Incremental Updates

Run the seeding script periodically (e.g., weekly) to keep data fresh:

```bash
# Cron job example (runs every Sunday at 3am)
0 3 * * 0 cd /path/to/parkshare && npm run seed
```

---

## 🔍 Data Quality

### Confidence Scores

Each parking spot has a `confidenceScore` (0-100):

- **98**: SF Open Data (parking meters) - Official, verified
- **95**: Google Places - Commercial data, high quality
- **90**: SF Parking Regulations - Official street data
- **85**: OpenStreetMap - Community-contributed
- **70**: User-reported spots (default)

### Deduplication

The seeding script automatically handles duplicates:
- Uses `onConflictDoNothing()` to skip existing spots
- Google Places deduplicated by `place_id`
- OpenStreetMap deduplicated by `osm_id`

---

## 🐛 Troubleshooting

### Error: "Google API quota exceeded"

**Solution**: You've hit the daily API limit. Either:
1. Wait 24 hours
2. Increase your Google Cloud quota
3. Run without Google Places (still get 11,000+ spots from other sources)

### Error: "CSV file not found"

**Solution**: Check your `SF_PARKING_CSV_PATH` environment variable:

```bash
# Verify the file exists
ls -la "$SF_PARKING_CSV_PATH"

# Set correct path
export SF_PARKING_CSV_PATH="/Users/khuedo/Downloads/Parking_regulations_20251025.csv"
```

### Error: "Overpass API timeout"

**Solution**: OpenStreetMap Overpass API is rate-limited. The script includes:
- 2-second delays between requests
- 90-second timeout per query
- If it fails, just re-run the script

### Database Connection Error

**Solution**: Ensure your `DATABASE_URL` is set:

```bash
# Check if set
echo $DATABASE_URL

# Set if needed
export DATABASE_URL="postgresql://user:pass@host/db"
```

---

## 📚 Related Documentation

- [Google Places API Docs](https://developers.google.com/maps/documentation/places/web-service)
- [OpenStreetMap Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [SF Open Data Portal](https://data.sfgov.org/)

---

## 💡 Tips for Best Results

1. **Run with Google API**: Get the most comprehensive parking lot/garage data
2. **Include the CSV**: Street-level parking with time restrictions is very valuable
3. **Re-run periodically**: Parking data changes over time
4. **Monitor API costs**: Google Places charges after free tier
5. **Use location-based filtering**: The app now fetches only nearby spots for better performance

---

## 🎯 Next Steps

After seeding your database:

1. **Test the app**:
   ```bash
   npm run dev
   ```

2. **Check the data**:
   - Open the app in your browser
   - Grant location permissions
   - You should see thousands of parking spots on the map

3. **Verify filtering**:
   - Check browser DevTools → Network tab
   - Look for API calls with `?lat=X&lon=Y&radius=5`
   - Only nearby spots (within 5 miles) should be loaded

---

**Happy parking! 🚗🅿️**
