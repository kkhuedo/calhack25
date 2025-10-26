/**
 * Parking Data Aggregator Service
 * Combines data from multiple sources:
 * - User-reported parking spots
 * - SFpark meter data
 * - Google Places parking facilities
 * - Predictive models (future enhancement)
 */

import type {
  ParkingAvailability,
  Coordinates,
  ParkingSpotInfo,
  ParkingPrediction,
} from "../../types/parking-data.types";
import { storage } from "../../storage";
import { sfparkService } from "./sfpark.service";
import { googlePlacesService } from "./google-places.service";

export class ParkingAggregatorService {
  /**
   * Get comprehensive parking availability for a location
   */
  async getParkingAvailability(
    location: Coordinates,
    radiusMeters: number = 500
  ): Promise<ParkingAvailability> {
    console.log(`[Aggregator] Getting parking availability for ${location.latitude}, ${location.longitude}`);

    // Fetch from all sources in parallel
    const [userSpots, sfparkSegments, googleLots] = await Promise.all([
      this.getUserReportedSpots(location, radiusMeters),
      sfparkService.getParkingAvailabilitySummary(location, radiusMeters),
      googlePlacesService.getParkingFacilities(location, radiusMeters),
    ]);

    // Generate predictions (placeholder for now)
    const predictions = this.generatePredictions(location, radiusMeters);

    // Calculate summary
    const totalAvailable = this.calculateTotalAvailable(userSpots, sfparkSegments);
    const confidenceScore = this.calculateConfidence(userSpots, sfparkSegments, googleLots);
    const recommendations = this.generateRecommendations(userSpots, sfparkSegments, googleLots);

    return {
      location,
      radius: radiusMeters,
      timestamp: new Date(),
      sources: {
        userReported: userSpots,
        sfpark: sfparkSegments,
        googlePlaces: googleLots,
        predictions,
      },
      summary: {
        totalAvailableSpots: totalAvailable,
        confidenceScore,
        recommendations,
      },
    };
  }

  /**
   * Get user-reported parking spots near a location
   */
  private async getUserReportedSpots(
    location: Coordinates,
    radiusMeters: number
  ): Promise<ParkingSpotInfo[]> {
    try {
      const allSlots = await storage.getParkingSlots();

      // Filter by distance and transform
      const spots: ParkingSpotInfo[] = allSlots
        .map(slot => {
          const distance = this.calculateDistance(
            location,
            { latitude: slot.latitude, longitude: slot.longitude }
          );

          return {
            id: slot.id,
            type: "street_spot" as const,
            location: {
              latitude: slot.latitude,
              longitude: slot.longitude,
            },
            address: slot.address,
            status: slot.status as "available" | "taken",
            source: "user" as const,
            confidence: this.calculateUserSpotConfidence(slot.postedAt),
            distance,
            postedAt: slot.postedAt,
            expiresAt: undefined,
            notes: slot.notes || undefined,
          };
        })
        .filter(spot => spot.distance <= radiusMeters)
        .sort((a, b) => a.distance - b.distance);

      console.log(`[Aggregator] Found ${spots.length} user-reported spots`);
      return spots;
    } catch (error) {
      console.error('[Aggregator] Error fetching user spots:', error);
      return [];
    }
  }

  /**
   * Calculate confidence score for user-reported spot based on age
   */
  private calculateUserSpotConfidence(postedAt: Date): number {
    const ageMinutes = (Date.now() - postedAt.getTime()) / (1000 * 60);

    // Confidence decreases over time
    if (ageMinutes < 5) return 0.95;
    if (ageMinutes < 15) return 0.85;
    if (ageMinutes < 30) return 0.70;
    if (ageMinutes < 60) return 0.50;
    if (ageMinutes < 120) return 0.30;
    return 0.15;
  }

  /**
   * Generate parking predictions using heuristics
   * (placeholder for ML model in the future)
   */
  private generatePredictions(
    location: Coordinates,
    radiusMeters: number
  ): ParkingPrediction[] {
    // Placeholder: Generate simple time-based predictions
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();

    let probabilityAvailable = 0.5; // Default 50%
    let timeOfDayFactor = 0.5;
    let dayOfWeekFactor = 0.5;

    // Time of day factors
    if (hour >= 9 && hour <= 17) {
      // Business hours - harder to find parking
      probabilityAvailable = 0.3;
      timeOfDayFactor = 0.3;
    } else if (hour >= 18 && hour <= 22) {
      // Evening - moderate difficulty
      probabilityAvailable = 0.5;
      timeOfDayFactor = 0.5;
    } else {
      // Late night/early morning - easier
      probabilityAvailable = 0.8;
      timeOfDayFactor = 0.8;
    }

    // Day of week factors
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Weekend - generally easier
      probabilityAvailable += 0.2;
      dayOfWeekFactor = 0.7;
    } else {
      // Weekday
      dayOfWeekFactor = 0.4;
    }

    probabilityAvailable = Math.min(probabilityAvailable, 1);

    let recommendation = "";
    if (probabilityAvailable > 0.7) {
      recommendation = "Good chance of finding street parking";
    } else if (probabilityAvailable > 0.4) {
      recommendation = "Moderate difficulty - consider parking lots";
    } else {
      recommendation = "Difficult - recommend using parking garage";
    }

    return [{
      location,
      address: "General area",
      type: "prediction",
      source: "model",
      confidence: 0.6,
      distance: 0,
      probabilityAvailable,
      factors: {
        timeOfDay: timeOfDayFactor,
        dayOfWeek: dayOfWeekFactor,
        historicalData: 0.5,
        nearbyActivity: 0.5,
      },
      recommendation,
    }];
  }

  /**
   * Calculate total available spots
   */
  private calculateTotalAvailable(
    userSpots: ParkingSpotInfo[],
    sfparkSegments: any[]
  ): number {
    const availableUserSpots = userSpots.filter(s => s.status === "available").length;
    const availableSFparkSpots = sfparkSegments.reduce(
      (sum, seg) => sum + seg.availableSpaces,
      0
    );

    return availableUserSpots + availableSFparkSpots;
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(
    userSpots: ParkingSpotInfo[],
    sfparkSegments: any[],
    googleLots: any[]
  ): number {
    const hasUserData = userSpots.length > 0;
    const hasSFparkData = sfparkSegments.length > 0;
    const hasGoogleData = googleLots.length > 0;

    const sourceCount = [hasUserData, hasSFparkData, hasGoogleData].filter(Boolean).length;

    // More sources = higher confidence
    if (sourceCount === 0) return 0.2; // No data
    if (sourceCount === 1) return 0.5; // Single source
    if (sourceCount === 2) return 0.7; // Two sources
    return 0.85; // All sources
  }

  /**
   * Generate recommendations based on available data
   */
  private generateRecommendations(
    userSpots: ParkingSpotInfo[],
    sfparkSegments: any[],
    googleLots: any[]
  ): string[] {
    const recommendations: string[] = [];

    const availableUserSpots = userSpots.filter(s => s.status === "available");

    if (availableUserSpots.length > 0) {
      const closest = availableUserSpots[0];
      const distanceText = closest.distance < 100
        ? "very close"
        : closest.distance < 300
        ? "nearby"
        : "within walking distance";

      recommendations.push(
        `Recently reported spot ${distanceText} (${Math.round(closest.distance)}m away)`
      );
    }

    if (sfparkSegments.length > 0) {
      const totalMeters = sfparkSegments.reduce((sum, seg) => sum + seg.totalSpaces, 0);
      recommendations.push(
        `${sfparkSegments.length} metered street segments with ${totalMeters} total spaces`
      );
    }

    if (googleLots.length > 0) {
      const freeLots = googleLots.filter(lot => lot.parkingOptions.free);
      const paidLots = googleLots.filter(lot => lot.parkingOptions.paid);

      if (freeLots.length > 0) {
        recommendations.push(`${freeLots.length} free parking lot(s) nearby`);
      }
      if (paidLots.length > 0) {
        recommendations.push(`${paidLots.length} paid parking facility/ies available`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push("No recent parking data for this area - try a parking app or garage");
    }

    return recommendations;
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
}

// Singleton instance
export const parkingAggregator = new ParkingAggregatorService();
