# 🅿️ Parking Availability API Guide

## Overview

ParkShare now integrates multiple parking data sources to provide comprehensive, real-time parking availability information:

1. **User-Reported Spots** - Community-shared parking spots
2. **SFpark / SF Open Data** - Parking meter locations and regulations
3. **Google Places API** - Parking lots and garages
4. **Predictive Models** - Time-based availability predictions

---

## 🚀 Quick Start

### 1. Environment Variables

Add these to your `.env` file:

```env
# Required
DATABASE_URL=postgresql://...

# Optional - for enhanced features
GOOGLE_PLACES_API_KEY=your-google-api-key-here
```

### 2. Get Google Places API Key (Optional but Recommended)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Places API (New)**
4. Go to **Credentials** → **Create API Key**
5. Add key to `.env` as `GOOGLE_PLACES_API_KEY`

**Cost:** Google gives $200 free credit/month. Places API charges:
- $0.032 per search request
- ~300 free searches/month with credit

**Without API key:** App still works with user-reported spots + SF Open Data

---

## 📡 API Endpoints

### 1. Get Aggregated Parking Availability (NEW)

**Endpoint:** `GET /api/parking-availability`

**Query Parameters:**
- `latitude` (required): Latitude of search location
- `longitude` (required): Longitude of search location
- `radius` (optional): Search radius in meters (100-5000, default: 500)

**Example Request:**
```bash
curl "http://localhost:5000/api/parking-availability?latitude=37.7749&longitude=-122.4194&radius=500"
```

**Example Response:**
```json
{
  "location": {
    "latitude": 37.7749,
    "longitude": -122.4194
  },
  "radius": 500,
  "timestamp": "2025-10-26T12:30:00.000Z",
  "sources": {
    "userReported": [
      {
        "id": "uuid-123",
        "type": "street_spot",
        "location": { "latitude": 37.7750, "longitude": -122.4195 },
        "address": "123 Market St, San Francisco, CA",
        "status": "available",
        "source": "user",
        "confidence": 0.85,
        "distance": 45,
        "postedAt": "2025-10-26T12:15:00.000Z",
        "notes": "In front of blue building"
      }
    ],
    "sfpark": [
      {
        "id": "sfpark_MARKET_100",
        "type": "street_segment",
        "location": { "latitude": 37.7748, "longitude": -122.4193 },
        "address": "100 Market St, San Francisco, CA",
        "source": "sfpark",
        "confidence": 0.7,
        "distance": 30,
        "totalSpaces": 12,
        "availableSpaces": 0,
        "occupancyRate": 0.5,
        "regulations": {
          "metered": true,
          "hours": "8am-6pm Mon-Sat"
        },
        "lastUpdated": "2025-10-26T12:30:00.000Z"
      }
    ],
    "googlePlaces": [
      {
        "id": "google_ChIJxyz123",
        "type": "garage",
        "location": { "latitude": 37.7745, "longitude": -122.4190 },
        "name": "Downtown Parking Garage",
        "source": "google",
        "confidence": 0.8,
        "distance": 120,
        "parkingOptions": {
          "paid": true,
          "free": false,
          "valet": false
        },
        "rating": 4.2,
        "lastUpdated": "2025-10-26T12:30:00.000Z"
      }
    ],
    "predictions": [
      {
        "location": { "latitude": 37.7749, "longitude": -122.4194 },
        "address": "General area",
        "type": "prediction",
        "source": "model",
        "confidence": 0.6,
        "distance": 0,
        "probabilityAvailable": 0.3,
        "factors": {
          "timeOfDay": 0.3,
          "dayOfWeek": 0.4,
          "historicalData": 0.5,
          "nearbyActivity": 0.5
        },
        "recommendation": "Difficult - recommend using parking garage"
      }
    ]
  },
  "summary": {
    "totalAvailableSpots": 1,
    "confidenceScore": 0.85,
    "recommendations": [
      "Recently reported spot very close (45m away)",
      "1 metered street segments with 12 total spaces",
      "1 paid parking facility/ies available"
    ]
  }
}
```

---

### 2. Existing Endpoints (Still Work)

#### Get All Parking Slots
```bash
GET /api/parking-slots
```

#### Create Parking Slot
```bash
POST /api/parking-slots
Content-Type: application/json

{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "address": "123 Market St",
  "notes": "Near coffee shop",
  "status": "available"
}
```

#### Update Parking Slot
```bash
PATCH /api/parking-slots/:id
Content-Type: application/json

{
  "status": "taken"
}
```

#### Delete Parking Slot
```bash
DELETE /api/parking-slots/:id
```

---

## 🏗️ Architecture

```
Frontend Request
       ↓
 API Gateway (/api/parking-availability)
       ↓
 Aggregator Service
    ↙  ↓  ↘
   /   |   \
User  SF   Google
Data  Park Places
  ↘   ↓   ↙
   Combined
   Response
```

---

## 🔧 Data Sources Details

### 1. User-Reported Spots

**Source:** Your PostgreSQL database
**Update Frequency:** Real-time via WebSocket
**Confidence:** High when recent (< 5 min), decreases over time
**Coverage:** Depends on user contributions

**Confidence Decay:**
- < 5 min: 95%
- < 15 min: 85%
- < 30 min: 70%
- < 60 min: 50%
- < 2 hours: 30%
- > 2 hours: 15%

---

### 2. SFpark / SF Open Data

**Source:** [SF Open Data Portal](https://datasf.org/)
**Update Frequency:** Static data (meter locations), cached for 30 min
**Confidence:** 70% (locations accurate, availability estimated)
**Coverage:** San Francisco only, ~7,000 metered spaces

**Datasets Used:**
- [Parking Meters](https://data.sfgov.org/Transportation/Parking-Meters/8vzz-qzz9) - Location and type
- [Parking Regulations](https://data.sfgov.org/Transportation/Map-of-Parking-Regulations/xewp-suj4) - Time limits, hours

**Limitations:**
- No real-time occupancy (SFpark sensors deprecated)
- Assumes 50% occupancy rate
- Meter locations only (not all street parking)

---

### 3. Google Places API

**Source:** [Google Places API (New)](https://developers.google.com/maps/documentation/places)
**Update Frequency:** Cached for 1 hour
**Confidence:** 80% (Google data generally reliable)
**Coverage:** Worldwide parking lots and garages

**Returns:**
- Parking lot and garage locations
- Paid vs free information
- Ratings and reviews
- Valet availability

**Limitations:**
- Doesn't provide real-time occupancy
- Focused on off-street parking (lots/garages)
- Requires API key

---

### 4. Predictive Model

**Source:** Time-based heuristics
**Update Frequency:** Real-time
**Confidence:** 60%
**Coverage:** All locations

**Factors:**
- **Time of Day:**
  - 9am-5pm (business hours): 30% probability
  - 6pm-10pm (evening): 50% probability
  - 11pm-8am (night): 80% probability

- **Day of Week:**
  - Weekdays: Harder (-20%)
  - Weekends: Easier (+20%)

**Future Enhancements:**
- Historical data analysis
- Event detection (concerts, games)
- Traffic pattern correlation
- Machine learning model

---

## 🧪 Testing

### 1. Test Basic Availability

```bash
# San Francisco Financial District
curl "http://localhost:5000/api/parking-availability?latitude=37.7946&longitude=-122.3999&radius=300"
```

### 2. Test Different Radii

```bash
# Small radius (100m)
curl "http://localhost:5000/api/parking-availability?latitude=37.7749&longitude=-122.4194&radius=100"

# Large radius (2km)
curl "http://localhost:5000/api/parking-availability?latitude=37.7749&longitude=-122.4194&radius=2000"
```

### 3. Test Cache

```bash
# First call - fetches from APIs
time curl "http://localhost:5000/api/parking-availability?latitude=37.7749&longitude=-122.4194"

# Second call - returns from cache (much faster)
time curl "http://localhost:5000/api/parking-availability?latitude=37.7749&longitude=-122.4194"
```

### 4. Check Cache Stats

Add this endpoint to routes.ts for debugging:

```typescript
app.get("/api/cache-stats", (_req, res) => {
  res.json(cache.getStats());
});
```

---

## 📊 Performance

### Response Times

| Data Source | Typical Response Time | Cache Duration |
|-------------|----------------------|----------------|
| User Data | 10-50ms | N/A (real-time) |
| SF Open Data | 200-500ms | 30 minutes |
| Google Places | 300-800ms | 1 hour |
| **Total (first call)** | **500-1300ms** | - |
| **Total (cached)** | **10-50ms** | - |

### Optimization Tips

1. **Use appropriate radius** - Smaller radius = faster response
2. **Cache aggressively** - Most parking data doesn't change frequently
3. **Parallel fetching** - All sources fetched simultaneously
4. **Pagination** - Limit results if needed

---

## 🔐 Security & Rate Limits

### Google Places API Limits

- **Free tier:** $200 credit/month (~6,250 searches)
- **Rate limit:** 100 requests/second
- **Daily limit:** Set in Google Cloud Console

**Cost Management:**
```typescript
// Recommended: Set max cache TTL to reduce API calls
const GOOGLE_CACHE_TTL = 3600; // 1 hour
```

### SF Open Data Limits

- **No authentication required**
- **Rate limit:** ~1000 requests/hour
- **Best practice:** Cache for 30 min minimum

---

## 🚀 Deployment Checklist

- [ ] Add `GOOGLE_PLACES_API_KEY` to production environment
- [ ] Set up caching layer (Redis for production)
- [ ] Monitor API usage in Google Cloud Console
- [ ] Set up error alerting
- [ ] Enable CORS if frontend is on different domain
- [ ] Add request logging
- [ ] Implement rate limiting (express-rate-limit)

---

## 🛠️ Future Enhancements

### Phase 1 (Current)
- ✅ User-reported spots
- ✅ SF Open Data integration
- ✅ Google Places integration
- ✅ Basic caching
- ✅ Time-based predictions

### Phase 2 (Next)
- [ ] Redis caching for production
- [ ] Historical data analysis
- [ ] Event detection (concerts, sports)
- [ ] Traffic pattern correlation
- [ ] User feedback on accuracy

### Phase 3 (Advanced)
- [ ] Machine learning predictions
- [ ] Real-time sensor integration (if available)
- [ ] Multi-city support
- [ ] Parking reservation system
- [ ] Dynamic pricing suggestions

---

## 📞 Troubleshooting

### "Google Places API not configured"

**Solution:** Add `GOOGLE_PLACES_API_KEY` to `.env` file

### "SF Open Data not returning results"

**Possible causes:**
- API might be down
- Location outside San Francisco
- Network timeout

**Solution:** Check https://datasf.org/opendata/ status

### "Cache not working"

**Solution:**
- Check server logs for `[Cache HIT]` vs `[Cache MISS]`
- Verify cache TTL settings
- Clear cache: restart server

### "Slow response times"

**Solutions:**
- Reduce search radius
- Increase cache TTL
- Use Redis instead of in-memory cache
- Enable response compression

---

## 📚 Additional Resources

- [Google Places API Docs](https://developers.google.com/maps/documentation/places)
- [SF Open Data Portal](https://datasf.org/)
- [SFpark Historical Info](https://www.sfmta.com/projects/sfpark)
- [Haversine Distance Formula](https://en.wikipedia.org/wiki/Haversine_formula)

---

**Need help?** Open an issue on GitHub or check the logs!
