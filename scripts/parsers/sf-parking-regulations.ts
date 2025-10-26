/**
 * Parser for SF Parking Regulations CSV
 *
 * Converts street segments with parking regulations into individual parking spots.
 * Source: SF Municipal Transportation Agency (SFMTA)
 * File: Parking_regulations_(except_non-metered_color_curb)_20251025.csv
 */

import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';

export interface SFParkingRegulation {
  objectid: string;
  REGULATION: string;
  DAYS?: string;
  HOURS?: string;
  LENGTH_FT?: string;
  HRLIMIT?: string;
  RPPAREA1?: string;
  RPPAREA2?: string;
  RPPAREA3?: string;
  shape?: string; // MULTILINESTRING with coordinates
}

export interface ParsedParkingSpot {
  latitude: number;
  longitude: number;
  address: string;
  spotType: string;
  restrictions: {
    regulation: string;
    days?: string;
    hours?: string;
    timeLimit?: string;
    permitZone?: string;
    segmentLength?: number;
  };
  spotCount: number;
  confidenceScore: number;
}

/**
 * Parse MULTILINESTRING to extract coordinates
 * Example: "MULTILINESTRING ((-122.473990553 37.781814028, -122.473914429 37.780764073))"
 */
function parseMultiLineString(shape: string): { lat: number; lon: number }[] {
  const coordMatch = shape.match(/\(\(([^)]+)\)\)/);
  if (!coordMatch) return [];

  const coordPairs = coordMatch[1].split(',');
  return coordPairs.map(pair => {
    const [lon, lat] = pair.trim().split(' ').map(parseFloat);
    return { lat, lon };
  });
}

/**
 * Calculate midpoint of a line segment
 */
function getMidpoint(coords: { lat: number; lon: number }[]): { lat: number; lon: number } | null {
  if (coords.length === 0) return null;

  if (coords.length === 1) return coords[0];

  // For multiple points, get the middle point
  const midIndex = Math.floor(coords.length / 2);
  return coords[midIndex];
}

/**
 * Calculate number of parking spots based on segment length
 * Average car + buffer = 20 feet
 */
function calculateSpotCount(lengthFeet: number): number {
  const FEET_PER_SPOT = 20;
  const spots = Math.floor(lengthFeet / FEET_PER_SPOT);
  return Math.max(1, spots); // At least 1 spot
}

/**
 * Convert time format from HHMM to readable format
 * Example: "900" -> "9:00 AM", "1800" -> "6:00 PM"
 */
function formatTime(time: string): string {
  const hours = parseInt(time.substring(0, time.length - 2));
  const minutes = time.substring(time.length - 2);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
  return `${displayHours}:${minutes} ${ampm}`;
}

/**
 * Parse time range
 * Example: "900-1800" -> "9:00 AM - 6:00 PM"
 */
function parseTimeRange(hours: string): string {
  const [start, end] = hours.split('-');
  if (!start || !end) return hours;
  return `${formatTime(start)} - ${formatTime(end)}`;
}

/**
 * Determine spot type based on regulation
 */
function getSpotType(regulation: string): string {
  const reg = regulation.toLowerCase();

  if (reg.includes('meter')) return 'metered';
  if (reg.includes('time limited')) return 'street';
  if (reg.includes('no parking')) return 'street'; // Still track for completeness
  if (reg.includes('tow away')) return 'street';

  return 'street';
}

/**
 * Calculate confidence score based on data completeness
 */
function calculateConfidence(reg: SFParkingRegulation): number {
  let score = 80; // Base score for official data

  if (reg.DAYS) score += 5;
  if (reg.HOURS) score += 5;
  if (reg.LENGTH_FT) score += 5;
  if (reg.shape) score += 5;

  return Math.min(100, score);
}

/**
 * Parse CSV file and extract parking spots
 */
export async function parseSFParkingRegulationsCSV(filePath: string): Promise<ParsedParkingSpot[]> {
  console.log(`📄 Reading SF parking regulations CSV from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');

  const records: SFParkingRegulation[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`📊 Found ${records.length} parking regulation records`);

  const spots: ParsedParkingSpot[] = [];
  let skipped = 0;

  for (const record of records) {
    try {
      // Skip if no shape data
      if (!record.shape) {
        skipped++;
        continue;
      }

      // Skip "No parking" zones (we only want available parking)
      if (record.REGULATION?.toLowerCase().includes('no parking')) {
        skipped++;
        continue;
      }

      // Parse coordinates
      const coords = parseMultiLineString(record.shape);
      if (coords.length === 0) {
        skipped++;
        continue;
      }

      // Get midpoint of segment
      const midpoint = getMidpoint(coords);
      if (!midpoint) {
        skipped++;
        continue;
      }

      // Calculate spot count
      const lengthFeet = parseFloat(record.LENGTH_FT || '20');
      const spotCount = calculateSpotCount(lengthFeet);

      // Build restrictions object
      const restrictions: any = {
        regulation: record.REGULATION || 'Unknown',
        segmentLength: lengthFeet,
      };

      if (record.DAYS) {
        restrictions.days = record.DAYS;
      }

      if (record.HOURS) {
        restrictions.hours = parseTimeRange(record.HOURS);
        restrictions.hoursRaw = record.HOURS;
      }

      if (record.HRLIMIT) {
        restrictions.timeLimit = `${record.HRLIMIT} hours`;
      }

      // Add permit zones if any
      const permitZones = [record.RPPAREA1, record.RPPAREA2, record.RPPAREA3]
        .filter(Boolean)
        .join(', ');
      if (permitZones) {
        restrictions.permitZone = permitZones;
      }

      spots.push({
        latitude: midpoint.lat,
        longitude: midpoint.lon,
        address: `Street parking, San Francisco, CA`,
        spotType: getSpotType(record.REGULATION || ''),
        restrictions,
        spotCount,
        confidenceScore: calculateConfidence(record),
      });

    } catch (error) {
      skipped++;
      // Continue processing other records
    }
  }

  console.log(`✅ Parsed ${spots.length} parking spots`);
  console.log(`⚠️  Skipped ${skipped} invalid/no-parking records`);

  return spots;
}

/**
 * Filter spots to only include those near a location (performance optimization)
 */
export function filterNearbySpots(
  spots: ParsedParkingSpot[],
  centerLat: number,
  centerLon: number,
  radiusKm: number = 5
): ParsedParkingSpot[] {
  return spots.filter(spot => {
    const distance = calculateDistance(
      centerLat,
      centerLon,
      spot.latitude,
      spot.longitude
    );
    return distance <= radiusKm;
  });
}

/**
 * Haversine distance formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
