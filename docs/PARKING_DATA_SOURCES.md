# 🅿️ Comprehensive Parking Data Sources

## Overview
This document catalogs all available data sources for parking spot locations that can be ingested into ParkShare to pre-populate the map with known parking locations.

---

## 🏙️ San Francisco Data Sources

### 1. **SF Parking Meters** ⭐ PRIMARY
**Source:** SF Open Data
**URL:** https://data.sfgov.org/Transportation/Parking-Meters/8vzz-qzz9
**Format:** JSON API (Socrata SODA)
**Records:** ~28,000+ parking meters
**Update Frequency:** Monthly
**Cost:** FREE

**Data Fields:**
- `post_id` - Unique meter ID
- `meter_type` - Type of meter
- `street_name`, `street_num` - Location
- `latitude`, `longitude` - Coordinates
- `cap_color` - Curb color (red, yellow, green, white, blue, none)
- `smart_mete` - Smart meter (Y/N)
- `active_meter_flag` - Active (Y/N)
- `meter_vendor` - IPS, Duncan, POM
- `on_offstreet_type` - ON/OFF street
- `clr_guid` - Blockface ID

**API Endpoint:**
```
https://data.sfgov.org/resource/8vzz-qzz9.json
?$limit=50000
&active_meter_flag=Y
```

**Ingestion Value:** Each meter = 1 parking spot (minimum)

---

### 2. **SF Parking Census** ⭐ EXCELLENT
**Source:** SF Open Data
**URL:** https://data.sfgov.org/Transportation/Parking-Census/fq9u-a2g7
**Records:** ~400,000+ parking spaces
**Update Frequency:** Annual
**Cost:** FREE

**Data Fields:**
- `cnn` - Centerline Network ID
- `blockface_category` - Street parking, Off-street, etc.
- `noncurb_spaces` - Number of spaces
- `curb_spaces` - Curb spaces
- `total_spaces` - Total count
- `street_name`, `from_street`, `to_street` - Location
- `geometry` - GeoJSON polygon

**API Endpoint:**
```
https://data.sfgov.org/resource/fq9u-a2g7.json
?$limit=50000
```

**Ingestion Value:** ⭐⭐⭐ BEST - Gives exact count of parking spaces per block

---

### 3. **SF Parking Regulations**
**Source:** SF Open Data
**URL:** https://data.sfgov.org/Transportation/Parking-Regulations-Map/6nqh-5kvu
**Records:** ~100,000+ regulation zones
**Update Frequency:** Quarterly
**Cost:** FREE

**Data Fields:**
- `cnn` - Street segment ID
- `street_name`
- `parking_category` - Metered, 2hr, 1hr, no parking, etc.
- `time_limit_minutes`
- `days_in_effect` - Mon-Fri, etc.
- `hours_in_effect` - 8am-6pm, etc.
- `color_curb` - Red, yellow, white, green, blue
- `geometry` - Line geometry

**API Endpoint:**
```
https://data.sfgov.org/resource/6nqh-5kvu.json
?$limit=50000
&parking_category!=NO PARKING
```

**Ingestion Value:** Regulations + legal parking areas

---

### 4. **SF Parking Citations** 🚨 DISCOVER NEW SPOTS
**Source:** SF Open Data
**URL:** https://data.sfgov.org/Transportation/Parking-Citations/ab4h-6ztd
**Records:** ~2M+ citations per year
**Update Frequency:** Daily
**Cost:** FREE

**Data Fields:**
- `citation_number`
- `citation_issued_datetime`
- `violation_code` - Type of violation
- `violation_description`
- `fine_amount`
- `latitude`, `longitude` - Where ticket was issued
- `street_name`, `street_block`

**API Endpoint:**
```
https://data.sfgov.org/resource/ab4h-6ztd.json
?$where=citation_issued_datetime > '2024-01-01'
&$limit=50000
```

**Ingestion Strategy:**
- **Filter:** Only expired meter violations (violation_code = 80)
- **Logic:** If someone got a parking ticket there, it's a legal parking spot!
- **Cluster:** Group citations by lat/lon to identify unique spots
- **Value:** Discovers spots NOT in official data

---

### 5. **SF Curb Regulations API** (New!)
**Source:** SharedStreets CurbLR
**URL:** https://github.com/sharedstreets/curblr
**Format:** CurbLR JSON standard
**Cost:** FREE (if SF implements it)

**Status:** SF is piloting this - check if available

---

## 🌎 Google Maps Data

### 6. **Google Maps Places API - Parking**
**Source:** Google Places API
**URL:** https://developers.google.com/maps/documentation/places
**Cost:** $0.032 per request, $200 free/month

**Query Types:**
```javascript
// Find parking lots/garages
includedTypes: ['parking']

// Find street parking areas
textQuery: 'street parking near [location]'
```

**Data Fields:**
- `id` - Place ID
- `location` - Lat/lon
- `displayName` - Name
- `types` - parking, parking_garage, etc.
- `parkingOptions` - paid, free, street, lot, garage

**Ingestion Value:** Off-street parking (lots, garages)

---

### 7. **Google Maps Street View - Visual Detection**
**Source:** Google Street View API
**Technique:** CV/ML to detect painted parking lines
**Cost:** $0.007 per image
**Status:** Advanced - requires ML model

---

## 🏛️ Government Parking Assets

### 8. **SFMTA Managed Off-Street Parking**
**Source:** SF Open Data
**URL:** https://data.sfgov.org/Transportation/SFMTA-Managed-Off-street-Parking/cqik-y4ps
**Records:** ~20 city-owned garages/lots
**Cost:** FREE

**Data Fields:**
- `facility_name`
- `address`
- `total_spaces` - Capacity
- `operating_hours`
- `rate_schedule`
- `ev_charging` - EV charger availability
- `latitude`, `longitude`

---

## 🚗 Private Parking Data Providers

### 9. **ParkWhiz / SpotHero API**
**Source:** Commercial API
**URL:** https://www.spothero.com/developers
**Cost:** Commercial license
**Data:** Off-street parking facilities with real-time availability

---

### 10. **Parkopedia API**
**Source:** Commercial API
**URL:** https://www.parkopedia.com/parking-api/
**Cost:** Paid (pricing varies)
**Coverage:** Worldwide parking data
**Data:** 70M+ parking spaces globally

---

## 📊 Multi-City Data Sources

### 11. **OpenStreetMap (OSM)**
**Source:** OpenStreetMap
**URL:** https://www.openstreetmap.org
**Cost:** FREE
**Coverage:** Worldwide

**Query:** Overpass API
```
[out:json];
area["name"="San Francisco"]->.a;
(
  node(area.a)["amenity"="parking"];
  way(area.a)["amenity"="parking"];
  node(area.a)["parking"="street_side"];
  way(area.a)["parking:lane"];
);
out geom;
```

**Data Fields:**
- `amenity=parking` - Parking lots
- `parking=street_side` - Street parking
- `parking:lane=parallel` - Parallel parking
- `capacity` - Number of spaces (if tagged)

**Ingestion Value:** Community-maintained, global coverage

---

### 12. **US Census TIGER/Line**
**Source:** US Census Bureau
**URL:** https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html
**Cost:** FREE
**Data:** Street centerlines + attributes

**Use Case:** Identify street segments, estimate parking based on street width

---

## 🧠 Heuristic Data Sources

### 13. **Street Width Analysis**
**Technique:** Calculate from street data
**Logic:**
- Street width > 40ft → Likely has parallel parking
- Residential streets → Usually have parking
- Arterial streets → Check regulations

**Data Source:** SF Street Centerline data

---

### 14. **Zoning + Land Use**
**Source:** SF Planning Department
**URL:** https://data.sfgov.org/Housing-and-Buildings/Land-Use/us3s-fp9q
**Logic:**
- Residential zones → Street parking likely
- Commercial zones → Check meters
- Industrial zones → Check regulations

---

## 📱 Real-Time Data (Future)

### 15. **Waze Traffic Data**
**Source:** Waze for Cities
**URL:** https://www.waze.com/ccp
**Cost:** FREE for cities
**Data:** Crowdsourced parking availability (limited)

---

### 16. **Parking Sensor Networks**
**Status:** Limited deployment
**Examples:**
- SF had SFpark sensors (mostly decommissioned)
- Some cities: LA, Seattle have pilot programs

---

## 🎯 Recommended Ingestion Priority

### **Phase 1: High-Value, Free Data** (IMPLEMENT NOW)
1. ✅ **SF Parking Census** (400K spots with exact counts)
2. ✅ **SF Parking Meters** (28K metered spots)
3. ✅ **SF Parking Regulations** (legal parking zones)
4. ✅ **SF Parking Citations** (discover unmarked spots)
5. ✅ **SFMTA Off-Street Lots** (city garages)

**Result:** ~450,000+ known parking spots in SF

---

### **Phase 2: Enhanced Data** (NEXT)
6. ✅ **OpenStreetMap** (global coverage)
7. ✅ **Google Places API** (parking lots/garages)
8. ✅ **Street width analysis** (estimate residential parking)

**Result:** Global coverage + better accuracy

---

### **Phase 3: Advanced** (FUTURE)
9. ⏭️ Commercial APIs (Parkopedia, SpotHero)
10. ⏭️ Computer vision on Street View
11. ⏭️ Real-time sensor integration

---

## 🔧 Data Ingestion Architecture

```
Data Sources
    ↓
Ingestion Services (Parallel)
    ↓
Data Validation & Deduplication
    ↓
Transform to Standard Format
    ↓
Load into Database
    ↓
Geospatial Indexing
    ↓
API serves pre-loaded spots
    ↓
Users update availability only
```

---

## 📐 Data Quality Metrics

**For each ingested spot, track:**
- `source` - Which dataset it came from
- `confidence` - Quality score (0-1)
- `last_verified` - When data was confirmed
- `verification_count` - How many sources confirm it
- `user_reports` - User feedback on accuracy

**Confidence Scoring:**
- SF Parking Census: 0.95 (official count)
- Parking Meters: 0.98 (physical infrastructure)
- Citations: 0.80 (inferred from tickets)
- OSM: 0.70 (community-tagged)
- Heuristic: 0.50 (estimated)

---

## 🚀 Expected Results

**San Francisco Coverage:**
- Known parking spots: ~450,000
- Metered spots: ~28,000
- Off-street lots: ~50,000
- Street parking segments: ~370,000

**User Behavior Change:**
1. **Before:** User creates new spot when leaving
2. **After:** User sees existing spot, marks as "available"
3. **Discovery:** If user parks in unmapped location → auto-create new spot

---

## 📝 Implementation Notes

### Deduplication Strategy
```python
# Spots within 5 meters = same spot
if distance(spot1, spot2) < 5:
    merge_spots()
    keep_highest_confidence_source()
```

### Update Frequency
- **Meters/Census:** Monthly refresh
- **Regulations:** Weekly refresh
- **Citations:** Daily incremental load
- **User updates:** Real-time

### Storage Estimate
- 450K spots × 500 bytes = ~225 MB
- Plus geometry: ~500 MB total
- Totally manageable in PostgreSQL

---

## 🎯 Next Steps

1. Build ingestion services for each data source
2. Create unified spot schema
3. Implement deduplication logic
4. Build background job scheduler
5. Seed database with initial data
6. Update API to serve pre-loaded spots
7. Add "mark as available/taken" endpoints

---

**Let's build this!** 🚀
