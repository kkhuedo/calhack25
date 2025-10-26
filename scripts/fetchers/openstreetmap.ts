/**
 * OpenStreetMap / Overpass API Fetcher for Parking Spots
 *
 * Fetches parking data from OpenStreetMap using the Overpass API.
 * Completely FREE - no API key required!
 *
 * Docs: https://wiki.openstreetmap.org/wiki/Overpass_API
 */

export interface OSMElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: {
    amenity?: string;
    parking?: string;
    capacity?: string;
    fee?: string;
    surface?: string;
    access?: string;
    name?: string;
    operator?: string;
    [key: string]: string | undefined;
  };
}

export interface OSMResponse {
  version: number;
  elements: OSMElement[];
}

export interface ParsedOSMSpot {
  osmId: number;
  osmType: string;
  latitude: number;
  longitude: number;
  name?: string;
  capacity?: number;
  fee: boolean;
  surface?: string;
  access?: string;
  operator?: string;
  parkingType: string;
  spotType: string;
}

/**
 * Query regions for comprehensive Bay Area coverage
 */
export const BAY_AREA_REGIONS = [
  {
    name: 'San Francisco',
    bounds: { south: 37.7, north: 37.82, west: -122.52, east: -122.35 },
  },
  {
    name: 'Berkeley/Oakland',
    bounds: { south: 37.77, north: 37.92, west: -122.35, east: -122.15 },
  },
  {
    name: 'Peninsula South',
    bounds: { south: 37.35, north: 37.55, west: -122.35, east: -122.05 },
  },
];

/**
 * Build Overpass QL query for parking in a bounding box
 */
export function buildOverpassQuery(bounds: {
  south: number;
  north: number;
  west: number;
  east: number;
}): string {
  const { south, west, north, east } = bounds;

  return `
    [out:json][timeout:90];
    (
      // Parking nodes (individual spots or entrances)
      node["amenity"="parking"](${south},${west},${north},${east});

      // Parking areas (lots, garages as polygons)
      way["amenity"="parking"](${south},${west},${north},${east});

      // Parking relations (complex structures)
      relation["amenity"="parking"](${south},${west},${north},${east});
    );
    out center;
  `.trim();
}

/**
 * Fetch parking data from OpenStreetMap for a specific region
 */
export async function fetchOSMParkingForRegion(
  region: typeof BAY_AREA_REGIONS[0]
): Promise<OSMElement[]> {
  console.log(`  🗺️  Fetching ${region.name}...`);

  const query = buildOverpassQuery(region.bounds);
  const url = 'https://overpass-api.de/api/interpreter';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      console.error(`    ❌ HTTP error: ${response.status}`);
      return [];
    }

    const data: OSMResponse = await response.json();
    const elements = data.elements || [];

    console.log(`    ✓ Found ${elements.length} parking areas`);
    return elements;

  } catch (error) {
    console.error(`    ❌ Error fetching ${region.name}:`, error);
    return [];
  }
}

/**
 * Fetch parking from all regions
 */
export async function fetchAllOSMParking(
  regions: typeof BAY_AREA_REGIONS = BAY_AREA_REGIONS,
  delayMs: number = 2000 // Be nice to OSM servers
): Promise<ParsedOSMSpot[]> {
  console.log(`🗺️  Fetching parking from OpenStreetMap...`);
  console.log(`📍 Querying ${regions.length} regions\n`);

  const allSpots: ParsedOSMSpot[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    console.log(`[${i + 1}/${regions.length}] ${region.name}`);

    const elements = await fetchOSMParkingForRegion(region);

    for (const element of elements) {
      const uniqueId = `${element.type}-${element.id}`;

      if (seenIds.has(uniqueId)) continue;
      seenIds.add(uniqueId);

      const parsed = parseOSMElement(element);
      if (parsed) {
        allSpots.push(parsed);
      }
    }

    console.log(`    📊 Total unique spots: ${allSpots.length}\n`);

    // Rate limiting: be nice to OSM servers
    if (i < regions.length - 1) {
      await sleep(delayMs);
    }
  }

  console.log(`✅ Completed OSM fetch: ${allSpots.length} parking spots\n`);

  return allSpots;
}

/**
 * Parse OSM element into parking spot
 */
export function parseOSMElement(element: OSMElement): ParsedOSMSpot | null {
  // Get coordinates
  let lat: number | undefined;
  let lon: number | undefined;

  if (element.lat && element.lon) {
    lat = element.lat;
    lon = element.lon;
  } else if (element.center) {
    lat = element.center.lat;
    lon = element.center.lon;
  }

  if (!lat || !lon) return null;

  const tags = element.tags || {};

  // Parse capacity
  let capacity = 1;
  if (tags.capacity) {
    const parsed = parseInt(tags.capacity);
    if (!isNaN(parsed)) {
      capacity = Math.max(1, parsed);
    }
  }

  // Determine parking type
  const parkingType = tags.parking || 'surface';
  const spotType = determineSpotType(parkingType);

  // Check if fee required
  const fee = tags.fee === 'yes';

  return {
    osmId: element.id,
    osmType: element.type,
    latitude: lat,
    longitude: lon,
    name: tags.name,
    capacity,
    fee,
    surface: tags.surface,
    access: tags.access,
    operator: tags.operator,
    parkingType,
    spotType,
  };
}

/**
 * Determine spot type from OSM parking tag
 */
function determineSpotType(parkingType: string): string {
  switch (parkingType.toLowerCase()) {
    case 'multi-storey':
    case 'underground':
    case 'parking_garage':
      return 'garage';

    case 'surface':
    case 'parking_lot':
      return 'public_lot';

    case 'street_side':
    case 'lane':
    case 'on_street':
      return 'street';

    default:
      return 'public_lot';
  }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Advanced query: fetch parking with specific filters
 */
export async function fetchOSMParkingAdvanced(options: {
  bounds: { south: number; north: number; west: number; east: number };
  requireCapacity?: boolean;
  freeOnly?: boolean;
  parkingTypes?: string[]; // ['surface', 'multi-storey', 'underground']
}): Promise<OSMElement[]> {
  const { bounds, requireCapacity, freeOnly, parkingTypes } = options;
  const { south, west, north, east } = bounds;

  let filters = '';

  if (requireCapacity) {
    filters += '["capacity"]';
  }

  if (freeOnly) {
    filters += '["fee"!="yes"]';
  }

  if (parkingTypes && parkingTypes.length > 0) {
    const typeFilter = parkingTypes.map(t => `["parking"="${t}"]`).join('');
    filters += typeFilter;
  }

  const query = `
    [out:json][timeout:90];
    (
      node["amenity"="parking"]${filters}(${south},${west},${north},${east});
      way["amenity"="parking"]${filters}(${south},${west},${north},${east});
      relation["amenity"="parking"]${filters}(${south},${west},${north},${east});
    );
    out center;
  `.trim();

  const url = 'https://overpass-api.de/api/interpreter';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data: OSMResponse = await response.json();
    return data.elements || [];

  } catch (error) {
    console.error('Error fetching advanced OSM data:', error);
    return [];
  }
}
