/**
 * SF Parking Citations Data Ingestion
 *
 * Source: https://data.sfgov.org/Transportation/Parking-Citations/ab4h-6ztd
 * Records: ~2M+ citations per year
 * Updates: Daily
 *
 * INSIGHT: If someone got a parking ticket there, it's a legal parking spot!
 * We can discover unmarked parking spots by clustering ticket locations.
 */

import type { InsertParkingSpot } from "../../../shared/schema-v2";

interface SFParkingCitationRecord {
  citation_number: string;
  citation_issued_datetime: string;
  violation_code: string;
  violation_description: string;
  fine_amount: string;
  latitude: string;
  longitude: string;
  street_name: string;
  street_block: string;
}

export class SFParkingCitationsService {
  private readonly BASE_URL = "https://data.sfgov.org/resource/ab4h-6ztd.json";
  private readonly BATCH_SIZE = 5000;

  // Violation codes that indicate LEGAL parking spots
  // (exclude illegal parking violations)
  private readonly LEGAL_SPOT_VIOLATIONS = [
    '80', // Expired meter
    '91', // Street cleaning
    '40', // Time limit exceeded
    '77', // Residential permit zone
  ];

  /**
   * Fetch recent citations (last 6 months)
   * We don't need all historical data - recent is enough
   */
  async fetchRecentCitations(monthsBack: number = 6): Promise<SFParkingCitationRecord[]> {
    const allCitations: SFParkingCitationRecord[] = [];
    let offset = 0;
    let hasMore = true;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`[SF Citations] Fetching citations from ${startDateStr} to ${endDateStr}...`);

    while (hasMore && offset < 50000) { // Limit to 50K citations for performance
      try {
        const violationCodes = this.LEGAL_SPOT_VIOLATIONS.map(c => `'${c}'`).join(',');

        const url = `${this.BASE_URL}?` +
          `$limit=${this.BATCH_SIZE}&` +
          `$offset=${offset}&` +
          `$where=` +
          `citation_issued_datetime >= '${startDateStr}' AND ` +
          `citation_issued_datetime <= '${endDateStr}' AND ` +
          `violation_code IN (${violationCodes}) AND ` +
          `latitude IS NOT NULL AND longitude IS NOT NULL`;

        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const batch: SFParkingCitationRecord[] = await response.json();

        if (batch.length === 0) {
          hasMore = false;
        } else {
          allCitations.push(...batch);
          offset += this.BATCH_SIZE;
          console.log(`[SF Citations] Fetched ${allCitations.length} citations...`);
        }

        // Rate limiting - be extra nice to this large dataset
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`[SF Citations] Error fetching batch at offset ${offset}:`, error);
        throw error;
      }
    }

    console.log(`[SF Citations] Fetch complete. Total citations: ${allCitations.length}`);
    return allCitations;
  }

  /**
   * Cluster citations to identify unique parking spots
   * Citations within 10 meters = same spot
   */
  clusterCitations(citations: SFParkingCitationRecord[]): Map<string, SFParkingCitationRecord[]> {
    const clusters = new Map<string, SFParkingCitationRecord[]>();

    console.log(`[SF Citations] Clustering ${citations.length} citations...`);

    for (const citation of citations) {
      const lat = parseFloat(citation.latitude);
      const lon = parseFloat(citation.longitude);

      if (isNaN(lat) || isNaN(lon)) continue;

      // Create grid cell key (approximately 10m resolution)
      // At SF latitude, 0.0001 degrees ≈ 11 meters
      const gridLat = Math.round(lat * 10000) / 10000;
      const gridLon = Math.round(lon * 10000) / 10000;
      const gridKey = `${gridLat},${gridLon}`;

      if (!clusters.has(gridKey)) {
        clusters.set(gridKey, []);
      }

      clusters.get(gridKey)!.push(citation);
    }

    console.log(`[SF Citations] Identified ${clusters.size} unique parking spot clusters`);
    return clusters;
  }

  /**
   * Transform citation clusters to parking spots
   */
  transformToParkingSpots(clusters: Map<string, SFParkingCitationRecord[]>): InsertParkingSpot[] {
    const spots: InsertParkingSpot[] = [];

    for (const [gridKey, citations] of clusters) {
      // Need at least 3 citations to confirm it's a real spot
      if (citations.length < 3) continue;

      // Calculate centroid of all citations in cluster
      let sumLat = 0;
      let sumLon = 0;

      for (const citation of citations) {
        sumLat += parseFloat(citation.latitude);
        sumLon += parseFloat(citation.longitude);
      }

      const latitude = sumLat / citations.length;
      const longitude = sumLon / citations.length;

      // Use most common street name
      const streetCounts = new Map<string, number>();
      for (const citation of citations) {
        const street = citation.street_name || 'Unknown';
        streetCounts.set(street, (streetCounts.get(street) || 0) + 1);
      }

      const mostCommonStreet = Array.from(streetCounts.entries())
        .sort((a, b) => b[1] - a[1])[0][0];

      const streetBlock = citations[0].street_block || '';
      const address = `${streetBlock} ${mostCommonStreet}, San Francisco, CA`;

      // Confidence based on number of citations
      // More citations = more certain it's a real spot
      const confidence = Math.min(0.80, 0.50 + (citations.length * 0.05));

      spots.push({
        latitude,
        longitude,
        address,
        spotType: 'street', // Assumed street parking
        capacity: 1,
        availableSpaces: 0,
        primarySource: 'sf_citations',
        sourceId: `cluster_${gridKey}`,
        confidence,
        verifiedSources: ['sf_citations'],
        regulations: {
          isMetered: citations.some(c => c.violation_code === '80'), // Expired meter
        },
        attributes: {},
        metadata: {
          citation_count: citations.length,
          date_range: {
            first: citations[0].citation_issued_datetime,
            last: citations[citations.length - 1].citation_issued_datetime,
          },
          violation_codes: Array.from(new Set(citations.map(c => c.violation_code))),
        },
        isActive: true,
        needsVerification: true, // Flag for manual review since this is inferred
      });
    }

    console.log(`[SF Citations] Transformed ${spots.length} parking spots`);
    return spots;
  }

  /**
   * Ingest citation data
   */
  async ingestAll(monthsBack: number = 6): Promise<InsertParkingSpot[]> {
    console.log('[SF Citations] ============================================');
    console.log('[SF Citations] Starting SF Parking Citations ingestion...');
    console.log('[SF Citations] This discovers unmarked parking spots!');
    console.log('[SF Citations] ============================================\n');

    const citations = await this.fetchRecentCitations(monthsBack);
    const clusters = this.clusterCitations(citations);
    const spots = this.transformToParkingSpots(clusters);

    console.log('\n[SF Citations] ============================================');
    console.log(`[SF Citations] Ingestion complete!`);
    console.log(`[SF Citations] Discovered ${spots.length} potential parking spots`);
    console.log(`[SF Citations] (flagged for verification)`);
    console.log('[SF Citations] ============================================\n');

    return spots;
  }
}

// Singleton instance
export const sfParkingCitationsService = new SFParkingCitationsService();
