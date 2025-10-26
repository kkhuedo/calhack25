/**
 * Geospatial utility functions for parking spot distance calculations
 */

/**
 * Calculate distance between two points using the Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Find the closest parking spot to a given location within a max distance
 * @param latitude Target latitude
 * @param longitude Target longitude
 * @param spots Array of parking spots to search
 * @param maxDistanceMeters Maximum distance in meters (default: 20m)
 * @returns Closest spot and distance, or null if none found within range
 */
export function findClosestSpot<T extends { latitude: number; longitude: number }>(
  latitude: number,
  longitude: number,
  spots: T[],
  maxDistanceMeters: number = 20
): { spot: T; distance: number } | null {
  let closestSpot: T | null = null;
  let minDistance = Infinity;

  for (const spot of spots) {
    const distance = calculateDistance(latitude, longitude, spot.latitude, spot.longitude);
    if (distance < minDistance && distance <= maxDistanceMeters) {
      minDistance = distance;
      closestSpot = spot;
    }
  }

  return closestSpot ? { spot: closestSpot, distance: minDistance } : null;
}
