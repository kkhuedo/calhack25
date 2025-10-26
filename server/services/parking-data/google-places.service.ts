/**
 * Google Places API Integration
 * Finds parking lots, garages, and parking-related places
 *
 * API Documentation:
 * https://developers.google.com/maps/documentation/places/web-service/search-nearby
 *
 * Note: Requires GOOGLE_PLACES_API_KEY environment variable
 */

import type {
  GooglePlacesParkingResponse,
  GooglePlace,
  Coordinates,
  ParkingLotInfo,
} from "../../types/parking-data.types";
import { cache } from "../cache.service";

export class GooglePlacesService {
  private readonly apiKey: string | undefined;
  private readonly baseUrl = "https://places.googleapis.com/v1/places:searchNearby";
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor() {
    this.apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!this.apiKey) {
      console.warn('[GooglePlaces] API key not configured. Set GOOGLE_PLACES_API_KEY in .env');
    }
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Search for parking facilities near a location
   */
  async searchParkingNearby(
    location: Coordinates,
    radiusMeters: number = 500
  ): Promise<GooglePlace[]> {
    if (!this.isConfigured()) {
      console.log('[GooglePlaces] Service not configured, skipping');
      return [];
    }

    const cacheKey = `google:parking:${location.latitude},${location.longitude}:${radiusMeters}`;

    return cache.getOrSet(
      cacheKey,
      async () => {
        try {
          console.log(`[GooglePlaces] Searching for parking near ${location.latitude}, ${location.longitude}`);

          // Using the new Places API (New)
          // https://developers.google.com/maps/documentation/places/web-service/op-overview
          const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': this.apiKey!,
              'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.types,places.parkingOptions,places.businessStatus,places.rating,places.userRatingCount',
            },
            body: JSON.stringify({
              includedTypes: ['parking'],
              maxResultCount: 20,
              locationRestriction: {
                circle: {
                  center: {
                    latitude: location.latitude,
                    longitude: location.longitude,
                  },
                  radius: radiusMeters,
                },
              },
            }),
            signal: AbortSignal.timeout(10000), // 10 second timeout
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Google Places API error: ${response.status} - ${errorText}`);
          }

          const data: GooglePlacesParkingResponse = await response.json();
          const places = data.places || [];

          console.log(`[GooglePlaces] Found ${places.length} parking facilities`);

          return places;
        } catch (error) {
          console.error('[GooglePlaces] Error searching parking:', error);
          return [];
        }
      },
      this.CACHE_TTL
    );
  }

  /**
   * Transform Google Places data to ParkingLotInfo format
   */
  transformPlacesToParkingInfo(
    places: GooglePlace[],
    userLocation: Coordinates
  ): ParkingLotInfo[] {
    return places.map(place => {
      const distance = this.calculateDistance(
        userLocation,
        place.location
      );

      // Determine if paid or free
      const parkingOptions = place.parkingOptions || {};
      const hasPaid = parkingOptions.paidParkingLot || parkingOptions.paidGarageParking || parkingOptions.paidStreetParking;
      const hasFree = parkingOptions.freeParkingLot || parkingOptions.freeStreetParking;

      // Determine type
      let type: "parking_lot" | "garage" = "parking_lot";
      if (place.types?.includes('parking_garage') || parkingOptions.paidGarageParking) {
        type = "garage";
      }

      return {
        id: `google_${place.id}`,
        type,
        location: {
          latitude: place.location.latitude,
          longitude: place.location.longitude,
        },
        name: place.displayName?.text || "Parking Facility",
        address: undefined, // Can be fetched with additional API call if needed
        source: "google",
        confidence: 0.8, // Google data is generally reliable
        distance,
        parkingOptions: {
          paid: !!hasPaid,
          free: !!hasFree,
          valet: !!parkingOptions.valetParking,
        },
        rating: place.rating,
        lastUpdated: new Date(),
      };
    }).sort((a, b) => a.distance - b.distance);
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Get parking facilities near a location with transformed data
   */
  async getParkingFacilities(
    location: Coordinates,
    radiusMeters: number = 500
  ): Promise<ParkingLotInfo[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const places = await this.searchParkingNearby(location, radiusMeters);
    return this.transformPlacesToParkingInfo(places, location);
  }
}

// Singleton instance
export const googlePlacesService = new GooglePlacesService();
