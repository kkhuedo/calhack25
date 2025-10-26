/**
 * Google Places API Fetcher for Parking Spots
 *
 * Uses grid search pattern to comprehensively fetch parking lots and garages
 * from Google Places API across San Francisco Bay Area.
 */

export interface GooglePlaceResult {
  place_id: string;
  name: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  vicinity: string;
  types: string[];
  rating?: number;
  user_ratings_total?: number;
}

export interface GooglePlacesResponse {
  results: GooglePlaceResult[];
  status: string;
  next_page_token?: string;
  error_message?: string;
}

export interface ParsedGooglePlace {
  placeId: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  rating?: number;
  totalRatings?: number;
  spotType: string;
}

/**
 * Comprehensive search grid covering SF Bay Area with HIGH DENSITY
 * Grid points are ~800-1000m apart for maximum coverage
 */
export const SF_BAY_AREA_GRID = [
  // San Francisco - Downtown/Financial District (Dense coverage)
  { lat: 37.7937, lon: -122.3965, name: 'SF Financial District' },
  { lat: 37.7912, lon: -122.3990, name: 'SF Embarcadero' },
  { lat: 37.7879, lon: -122.4075, name: 'SF Union Square' },
  { lat: 37.7854, lon: -122.4044, name: 'SF Chinatown' },
  { lat: 37.7749, lon: -122.4194, name: 'SF Downtown' },
  { lat: 37.7833, lon: -122.4167, name: 'SF Civic Center' },

  // San Francisco - North
  { lat: 37.8024, lon: -122.4058, name: 'SF North Beach' },
  { lat: 37.8080, lon: -122.4177, name: 'SF Fisherman\'s Wharf' },
  { lat: 37.8048, lon: -122.4194, name: 'SF Pier 39 Area' },
  { lat: 37.7989, lon: -122.4662, name: 'SF Presidio' },
  { lat: 37.8066, lon: -122.4324, name: 'SF Marina District' },

  // San Francisco - West
  { lat: 37.7694, lon: -122.4862, name: 'SF Golden Gate Park East' },
  { lat: 37.7694, lon: -122.5062, name: 'SF Golden Gate Park West' },
  { lat: 37.7577, lon: -122.4376, name: 'SF Inner Sunset' },
  { lat: 37.7577, lon: -122.4576, name: 'SF Outer Sunset' },
  { lat: 37.7438, lon: -122.4627, name: 'SF West Portal' },

  // San Francisco - East/South
  { lat: 37.7897, lon: -122.3972, name: 'SF Mission District' },
  { lat: 37.7697, lon: -122.4047, name: 'SF Castro' },
  { lat: 37.7599, lon: -122.4148, name: 'SF Mission Bay' },
  { lat: 37.7506, lon: -122.4121, name: 'SF Potrero Hill' },
  { lat: 37.7272, lon: -122.4657, name: 'SF Daly City' },
  { lat: 37.7118, lon: -122.4426, name: 'SF South SF' },

  // San Francisco - Richmond/Sunset
  { lat: 37.7806, lon: -122.4644, name: 'SF Richmond District' },
  { lat: 37.7644, lon: -122.4844, name: 'SF Outer Richmond' },

  // Berkeley (Dense coverage)
  { lat: 37.8716, lon: -122.2727, name: 'Berkeley Downtown' },
  { lat: 37.8825, lon: -122.2589, name: 'Berkeley North/Hills' },
  { lat: 37.8600, lon: -122.2800, name: 'Berkeley South' },
  { lat: 37.8697, lon: -122.2584, name: 'UC Berkeley Campus' },
  { lat: 37.8764, lon: -122.2672, name: 'Berkeley Telegraph Ave' },

  // Oakland (Dense coverage)
  { lat: 37.8044, lon: -122.2712, name: 'Oakland Downtown' },
  { lat: 37.8152, lon: -122.2364, name: 'Oakland Lake Merritt' },
  { lat: 37.8088, lon: -122.2697, name: 'Oakland Uptown' },
  { lat: 37.7955, lon: -122.2655, name: 'Oakland Jack London' },
  { lat: 37.7847, lon: -122.2647, name: 'Oakland Fruitvale' },
  { lat: 37.7688, lon: -122.2363, name: 'Oakland Airport Area' },
  { lat: 37.8270, lon: -122.2737, name: 'Oakland Rockridge' },

  // Emeryville/Berkeley Border
  { lat: 37.8404, lon: -122.2889, name: 'Emeryville' },

  // Peninsula Cities (Key areas)
  { lat: 37.5483, lon: -122.3050, name: 'Redwood City' },
  { lat: 37.5630, lon: -122.3255, name: 'San Carlos' },
  { lat: 37.4443, lon: -122.1598, name: 'Palo Alto Downtown' },
  { lat: 37.4419, lon: -122.1430, name: 'Palo Alto Stanford' },
  { lat: 37.3861, lon: -122.0839, name: 'Mountain View' },
  { lat: 37.3688, lon: -122.0363, name: 'Sunnyvale' },

  // San Jose (Major areas)
  { lat: 37.3382, lon: -121.8863, name: 'San Jose Downtown' },
  { lat: 37.3229, lon: -121.9575, name: 'San Jose West' },
];

/**
 * Fetch parking spots from Google Places API for a single location
 */
export async function fetchParkingForLocation(
  apiKey: string,
  location: { lat: number; lon: number; name: string },
  radiusMeters: number = 1000 // Reduced to 1km for more granular coverage
): Promise<GooglePlaceResult[]> {
  console.log(`  🔍 Searching ${location.name}...`);

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
    `location=${location.lat},${location.lon}&` +
    `radius=${radiusMeters}&` +
    `type=parking&` +
    `key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data: GooglePlacesResponse = await response.json();

    if (data.status === 'OVER_QUERY_LIMIT') {
      console.warn(`    ⚠️  API quota exceeded`);
      throw new Error('OVER_QUERY_LIMIT');
    }

    if (data.status === 'REQUEST_DENIED') {
      console.error(`    ❌ API request denied: ${data.error_message}`);
      throw new Error(`REQUEST_DENIED: ${data.error_message}`);
    }

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn(`    ⚠️  API error: ${data.status}`);
      return [];
    }

    let allResults = data.results || [];
    console.log(`    ✓ Found ${allResults.length} spots`);

    // Handle pagination (Google returns max 20 results per page)
    let nextPageToken = data.next_page_token;
    let pageCount = 1;

    while (nextPageToken && pageCount < 3) { // Limit to 3 pages (60 results max)
      // IMPORTANT: Must wait 2 seconds before using next_page_token
      await sleep(2000);

      const nextUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
        `pagetoken=${nextPageToken}&` +
        `key=${apiKey}`;

      const nextResponse = await fetch(nextUrl);
      const nextData: GooglePlacesResponse = await nextResponse.json();

      if (nextData.status === 'OK' && nextData.results) {
        allResults = allResults.concat(nextData.results);
        console.log(`    ✓ Page ${pageCount + 1}: +${nextData.results.length} spots (total: ${allResults.length})`);
        nextPageToken = nextData.next_page_token;
        pageCount++;
      } else {
        break;
      }
    }

    return allResults;
  } catch (error) {
    if (error instanceof Error && error.message === 'OVER_QUERY_LIMIT') {
      throw error;
    }
    console.error(`    ❌ Error fetching ${location.name}:`, error);
    return [];
  }
}

/**
 * Fetch parking from all grid locations
 */
export async function fetchAllGooglePlaces(
  apiKey: string,
  searchGrid: typeof SF_BAY_AREA_GRID = SF_BAY_AREA_GRID,
  radiusMeters: number = 1000, // 1km = ~0.6 miles, good for granular coverage
  delayMs: number = 1000
): Promise<ParsedGooglePlace[]> {
  console.log(`🅿️  Fetching parking from Google Places API (ENHANCED GRANULARITY)...`);
  console.log(`📍 Searching ${searchGrid.length} locations with ${radiusMeters}m radius\n`);

  const allPlaces: ParsedGooglePlace[] = [];
  const seenPlaceIds = new Set<string>();
  let quotaExceeded = false;

  for (let i = 0; i < searchGrid.length; i++) {
    if (quotaExceeded) break;

    const location = searchGrid[i];
    console.log(`[${i + 1}/${searchGrid.length}] ${location.name}`);

    try {
      const results = await fetchParkingForLocation(apiKey, location, radiusMeters);

      // Deduplicate by place_id
      for (const place of results) {
        if (!seenPlaceIds.has(place.place_id)) {
          seenPlaceIds.add(place.place_id);

          allPlaces.push({
            placeId: place.place_id,
            name: place.name,
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng,
            address: place.vicinity,
            rating: place.rating,
            totalRatings: place.user_ratings_total,
            spotType: determineSpotType(place),
          });
        }
      }

      console.log(`    📊 Total unique spots: ${allPlaces.length}\n`);

      // Rate limiting: wait between requests
      if (i < searchGrid.length - 1) {
        await sleep(delayMs);
      }

    } catch (error) {
      if (error instanceof Error && error.message === 'OVER_QUERY_LIMIT') {
        console.error(`\n⚠️  Google API quota exceeded. Stopping search.`);
        console.log(`✓ Successfully fetched ${allPlaces.length} spots before quota limit\n`);
        quotaExceeded = true;
        break;
      }
    }
  }

  console.log(`✅ Completed Google Places fetch: ${allPlaces.length} unique parking spots\n`);

  return allPlaces;
}

/**
 * Determine spot type from place data
 */
function determineSpotType(place: GooglePlaceResult): string {
  const name = place.name.toLowerCase();
  const types = place.types || [];

  if (name.includes('garage') || types.includes('parking_garage')) {
    return 'garage';
  }

  if (name.includes('lot') || types.includes('parking_lot')) {
    return 'public_lot';
  }

  // Default to public lot
  return 'public_lot';
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get place details (optional - for additional info like hours, phone, etc.)
 */
export async function getPlaceDetails(
  apiKey: string,
  placeId: string
): Promise<any> {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?` +
    `place_id=${placeId}&` +
    `fields=formatted_phone_number,opening_hours,website,price_level&` +
    `key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK') {
      return {
        phone: data.result.formatted_phone_number,
        website: data.result.website,
        hours: data.result.opening_hours?.weekday_text,
        priceLevel: data.result.price_level,
      };
    }
  } catch (error) {
    console.error(`Error fetching place details for ${placeId}:`, error);
  }

  return null;
}
