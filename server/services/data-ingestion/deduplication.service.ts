/**
 * Deduplication Service
 *
 * Merges parking spots that are too close together (likely duplicates from different sources)
 * Strategy:
 * - Spots within 5 meters = same spot
 * - Keep highest confidence source as primary
 * - Track all sources that verified this spot
 */

import type { InsertParkingSpot } from "../../../shared/schema-v2";

export class DeduplicationService {
  private readonly DUPLICATE_THRESHOLD_METERS = 5;

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth radius in meters
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
   * Find duplicates and merge them
   */
  deduplicate(spots: InsertParkingSpot[]): InsertParkingSpot[] {
    console.log(`[Dedup] Starting deduplication of ${spots.length} spots...`);

    const merged: InsertParkingSpot[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < spots.length; i++) {
      if (processed.has(i)) continue;

      const spot1 = spots[i];
      const duplicates: number[] = [i];

      // Find all spots within threshold distance
      for (let j = i + 1; j < spots.length; j++) {
        if (processed.has(j)) continue;

        const spot2 = spots[j];
        const distance = this.calculateDistance(
          spot1.latitude,
          spot1.longitude,
          spot2.latitude,
          spot2.longitude
        );

        if (distance <= this.DUPLICATE_THRESHOLD_METERS) {
          duplicates.push(j);
          processed.add(j);
        }
      }

      // Merge duplicates
      const mergedSpot = this.mergeSpots(duplicates.map(idx => spots[idx]));
      merged.push(mergedSpot);
      processed.add(i);
    }

    const duplicatesFound = spots.length - merged.length;
    console.log(`[Dedup] Found ${duplicatesFound} duplicates`);
    console.log(`[Dedup] Result: ${merged.length} unique spots`);

    return merged;
  }

  /**
   * Merge multiple spots into one
   * Strategy:
   * - Use coordinates from highest confidence source
   * - Combine capacity from all sources
   * - Track all verified sources
   * - Keep primary source with highest confidence
   */
  private mergeSpots(spots: InsertParkingSpot[]): InsertParkingSpot {
    if (spots.length === 1) return spots[0];

    // Sort by confidence (highest first)
    spots.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    const primarySpot = spots[0];

    // Collect all sources
    const verifiedSources = new Set<string>();
    for (const spot of spots) {
      verifiedSources.add(spot.primarySource);
      if (spot.verifiedSources) {
        spot.verifiedSources.forEach(s => verifiedSources.add(s));
      }
    }

    // Calculate average position (weighted by confidence)
    let totalWeight = 0;
    let weightedLat = 0;
    let weightedLon = 0;

    for (const spot of spots) {
      const weight = spot.confidence || 0.5;
      weightedLat += spot.latitude * weight;
      weightedLon += spot.longitude * weight;
      totalWeight += weight;
    }

    const latitude = weightedLat / totalWeight;
    const longitude = weightedLon / totalWeight;

    // Sum capacity (if multiple sources agree on capacity, use max)
    const capacity = Math.max(...spots.map(s => s.capacity || 1));

    // Merge regulations (prefer metered info from meters source)
    const meterSpot = spots.find(s => s.primarySource === 'sf_meters');
    const censusSpot = spots.find(s => s.primarySource === 'sf_parking_census');

    const regulations = {
      ...primarySpot.regulations,
      ...(meterSpot?.regulations || {}),
      ...(censusSpot?.regulations || {}),
    };

    // Merge metadata
    const metadata = {
      merged_from: spots.map(s => ({
        source: s.primarySource,
        sourceId: s.sourceId,
        confidence: s.confidence,
      })),
      ...primarySpot.metadata,
    };

    // Use highest confidence
    const confidence = Math.max(...spots.map(s => s.confidence || 0.5));

    return {
      ...primarySpot,
      latitude,
      longitude,
      capacity,
      confidence,
      verifiedSources: Array.from(verifiedSources),
      regulations,
      metadata,
      needsVerification: spots.some(s => s.needsVerification),
    };
  }

  /**
   * Fast deduplication using grid-based clustering
   * More efficient for large datasets
   */
  deduplicateFast(spots: InsertParkingSpot[]): InsertParkingSpot[] {
    console.log(`[Dedup Fast] Starting fast deduplication of ${spots.length} spots...`);

    // Create grid cells (approximately 5m resolution)
    // At SF latitude, 0.00005 degrees ≈ 5 meters
    const gridSize = 0.00005;
    const grid = new Map<string, InsertParkingSpot[]>();

    // Assign spots to grid cells
    for (const spot of spots) {
      const gridLat = Math.round(spot.latitude / gridSize) * gridSize;
      const gridLon = Math.round(spot.longitude / gridSize) * gridSize;
      const gridKey = `${gridLat.toFixed(6)},${gridLon.toFixed(6)}`;

      if (!grid.has(gridKey)) {
        grid.set(gridKey, []);
      }
      grid.get(gridKey)!.push(spot);
    }

    // Merge spots in each grid cell
    const merged: InsertParkingSpot[] = [];

    for (const [gridKey, cellSpots] of grid) {
      if (cellSpots.length === 1) {
        merged.push(cellSpots[0]);
      } else {
        // Spots in same grid cell are very close - merge them
        const mergedSpot = this.mergeSpots(cellSpots);
        merged.push(mergedSpot);
      }
    }

    const duplicatesFound = spots.length - merged.length;
    console.log(`[Dedup Fast] Found ${duplicatesFound} duplicates`);
    console.log(`[Dedup Fast] Result: ${merged.length} unique spots`);

    return merged;
  }
}

// Singleton instance
export const deduplicationService = new DeduplicationService();
