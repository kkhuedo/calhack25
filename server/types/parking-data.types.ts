/**
 * Types for external parking data sources
 */

// Common types
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

// SFpark API Response Types
export interface SFparkAvailability {
  NAME: string; // Street name
  OSPID: string; // On-street parking ID
  PHONE: string;
  DESC: string; // Description
  TYPE: string; // 'ON' for on-street
  BFID: string; // Blockface ID
  OPHRS: string; // Operating hours
  RATES: SFparkRate[];
  PTS: {
    AVAILABLE: number;
    TOTAL: number;
    OCCUPIED: number;
  };
  LOC: {
    LAT: number;
    LONG: number;
  };
}

export interface SFparkRate {
  RS: string; // Rate schedule
  BEG: string; // Begin time
  END: string; // End time
  RATE: string; // Rate in dollars
  DESC: string; // Description
}

// Google Places API Response Types
export interface GooglePlacesParkingResponse {
  places: GooglePlace[];
  nextPageToken?: string;
}

export interface GooglePlace {
  id: string;
  displayName: {
    text: string;
    languageCode: string;
  };
  location: {
    latitude: number;
    longitude: number;
  };
  types: string[];
  parkingOptions?: {
    paidParkingLot?: boolean;
    paidStreetParking?: boolean;
    freeParkingLot?: boolean;
    freeStreetParking?: boolean;
    paidGarageParking?: boolean;
    valetParking?: boolean;
  };
  businessStatus?: string;
  rating?: number;
  userRatingCount?: number;
}

// SF Open Data Types
export interface SFMeterData {
  meter_id: string;
  post_id: string;
  meter_type: string;
  street_name: string;
  street_num: string;
  latitude: string;
  longitude: string;
  smart_mete: string; // 'Y' or 'N'
  active_meter_flag: string; // 'Y' or 'N'
  jurisdiction: string;
}

export interface SFParkingRegulation {
  cnn: string; // Centerline Network ID
  street_name: string;
  street_block: string;
  from_cross_street: string;
  to_cross_street: string;
  left_side_parking?: string;
  right_side_parking?: string;
  time_limit_minutes?: number;
  color_curb?: string;
  metered?: string;
}

// Aggregated Parking Availability Response
export interface ParkingAvailability {
  location: Coordinates;
  radius: number; // meters
  timestamp: Date;
  sources: {
    userReported: ParkingSpotInfo[];
    sfpark: ParkingSegmentInfo[];
    googlePlaces: ParkingLotInfo[];
    predictions: ParkingPrediction[];
  };
  summary: {
    totalAvailableSpots: number;
    confidenceScore: number; // 0-1
    recommendations: string[];
  };
}

export interface ParkingSpotInfo {
  id: string;
  type: "street_spot";
  location: Coordinates;
  address: string;
  status: "available" | "taken";
  source: "user";
  confidence: number;
  distance: number; // meters from query location
  postedAt: Date;
  expiresAt?: Date;
  notes?: string;
}

export interface ParkingSegmentInfo {
  id: string;
  type: "street_segment";
  location: Coordinates;
  address: string;
  source: "sfpark";
  confidence: number;
  distance: number;
  totalSpaces: number;
  availableSpaces: number;
  occupancyRate: number; // 0-1
  regulations: {
    metered: boolean;
    timeLimit?: number;
    hours?: string;
    rates?: string;
  };
  lastUpdated: Date;
}

export interface ParkingLotInfo {
  id: string;
  type: "parking_lot" | "garage";
  location: Coordinates;
  name: string;
  address?: string;
  source: "google";
  confidence: number;
  distance: number;
  parkingOptions: {
    paid: boolean;
    free: boolean;
    valet: boolean;
  };
  rating?: number;
  lastUpdated: Date;
}

export interface ParkingPrediction {
  location: Coordinates;
  address: string;
  type: "prediction";
  source: "model";
  confidence: number;
  distance: number;
  probabilityAvailable: number; // 0-1
  factors: {
    timeOfDay: number; // Weight 0-1
    dayOfWeek: number;
    historicalData: number;
    nearbyActivity: number;
  };
  recommendation: string;
}

// API Configuration Types
export interface SFparkConfig {
  apiKey?: string;
  baseUrl: string;
  timeout: number;
  cacheDuration: number; // seconds
}

export interface GooglePlacesConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  cacheDuration: number;
}

export interface SFOpenDataConfig {
  baseUrl: string;
  datasets: {
    meters: string;
    regulations: string;
    lots: string;
  };
  timeout: number;
  cacheDuration: number;
}
