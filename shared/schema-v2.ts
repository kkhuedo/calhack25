/**
 * Enhanced Database Schema V2
 * Supports pre-loaded parking spots from multiple official sources
 * Users update availability status instead of creating new spots
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  doublePrecision,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * PARKING_SPOTS - Master table of all known parking locations
 * Pre-populated from official sources + user discoveries
 */
export const parkingSpots = pgTable("parking_spots", {
  // Identity
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Location
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  address: text("address"),

  // Spot Type
  spotType: varchar("spot_type", { length: 50 }).notNull().default("street"),
  // 'street', 'metered', 'lot', 'garage', 'handicap', 'ev_charging', 'motorcycle'

  // Capacity (for segments/lots with multiple spaces)
  capacity: integer("capacity").default(1), // How many cars can park here

  // Current Status (updated by users in real-time)
  availableSpaces: integer("available_spaces").default(0), // How many are free now
  lastStatusUpdate: timestamp("last_status_update"),

  // Data Source Tracking
  primarySource: varchar("primary_source", { length: 50 }).notNull(),
  // 'sf_parking_census', 'sf_meters', 'sf_citations', 'osm', 'google_places', 'user_discovered'

  sourceId: varchar("source_id", { length: 100 }), // ID from source system
  confidence: doublePrecision("confidence").default(0.5), // 0-1 confidence score
  verifiedSources: jsonb("verified_sources").$type<string[]>(), // Array of sources confirming this spot

  // Regulations & Restrictions
  regulations: jsonb("regulations").$type<{
    timeLimit?: number; // minutes
    days?: string; // "Mon-Fri"
    hours?: string; // "8am-6pm"
    isMetered?: boolean;
    meterType?: string;
    hourlyRate?: number;
    colorCurb?: string; // red, yellow, green, white, blue
    permitRequired?: boolean;
    permitZone?: string;
  }>(),

  // Physical Attributes
  attributes: jsonb("attributes").$type<{
    curbHeight?: string;
    surfaceType?: string;
    lighting?: boolean;
    coveredParking?: boolean;
    evCharging?: boolean;
    handicapAccessible?: boolean;
    length?: number; // feet
    width?: number; // feet
  }>(),

  // Metadata
  metadata: jsonb("metadata"), // Additional source-specific data

  // Tracking
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastVerified: timestamp("last_verified"),

  // Status flags
  isActive: boolean("is_active").default(true), // false if spot no longer exists
  needsVerification: boolean("needs_verification").default(false), // flag for review

}, (table) => ({
  // Geospatial index for fast location queries
  locationIdx: index("parking_spots_location_idx").on(table.latitude, table.longitude),
  // Source index
  sourceIdx: index("parking_spots_source_idx").on(table.primarySource),
  // Status update index
  statusIdx: index("parking_spots_status_idx").on(table.lastStatusUpdate),
}));

/**
 * SPOT_AVAILABILITY_HISTORY - Track availability changes over time
 * Used for predictions and analytics
 */
export const spotAvailabilityHistory = pgTable("spot_availability_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spotId: varchar("spot_id").notNull().references(() => parkingSpots.id, { onDelete: 'cascade' }),

  // Status change
  previousAvailable: integer("previous_available"),
  newAvailable: integer("new_available"),
  changedBy: varchar("changed_by", { length: 50 }), // 'user', 'system', 'sensor'
  userId: varchar("user_id"), // If changed by user

  // Context
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  dayOfWeek: integer("day_of_week"), // 0-6
  hourOfDay: integer("hour_of_day"), // 0-23

  // Metadata
  metadata: jsonb("metadata"), // Additional context
}, (table) => ({
  spotIdx: index("availability_history_spot_idx").on(table.spotId),
  timeIdx: index("availability_history_time_idx").on(table.timestamp),
}));

/**
 * SPOT_REPORTS - User reports about spot quality/issues
 */
export const spotReports = pgTable("spot_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spotId: varchar("spot_id").notNull().references(() => parkingSpots.id, { onDelete: 'cascade' }),

  reportType: varchar("report_type", { length: 50 }).notNull(),
  // 'incorrect_location', 'no_longer_exists', 'wrong_regulations', 'hazard', 'other'

  description: text("description"),
  userId: varchar("user_id"), // Anonymous allowed

  status: varchar("status", { length: 20 }).default("pending"),
  // 'pending', 'verified', 'rejected', 'fixed'

  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => ({
  spotIdx: index("spot_reports_spot_idx").on(table.spotId),
  statusIdx: index("spot_reports_status_idx").on(table.status),
}));

/**
 * DATA_INGESTION_LOGS - Track data imports
 */
export const dataIngestionLogs = pgTable("data_ingestion_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  source: varchar("source", { length: 50 }).notNull(),
  // 'sf_parking_census', 'sf_meters', 'sf_citations', etc.

  status: varchar("status", { length: 20 }).notNull(),
  // 'started', 'completed', 'failed'

  recordsProcessed: integer("records_processed").default(0),
  recordsCreated: integer("records_created").default(0),
  recordsUpdated: integer("records_updated").default(0),
  recordsSkipped: integer("records_skipped").default(0),
  recordsFailed: integer("records_failed").default(0),

  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),

  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  sourceIdx: index("ingestion_logs_source_idx").on(table.source),
  statusIdx: index("ingestion_logs_status_idx").on(table.status),
}));

/**
 * LEGACY: Keep for backward compatibility with existing user-created spots
 * Will be migrated to parkingSpots table
 */
export const parkingSlotsLegacy = pgTable("parking_slots_legacy", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  address: text("address").notNull(),
  notes: text("notes"),
  status: varchar("status", { length: 20 }).notNull().default("available"),
  postedAt: timestamp("posted_at").notNull().defaultNow(),
  migratedToSpotId: varchar("migrated_to_spot_id"), // Reference to parkingSpots after migration
});

// Schemas for validation
export const insertParkingSpotSchema = createInsertSchema(parkingSpots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  spotType: z.enum(['street', 'metered', 'lot', 'garage', 'handicap', 'ev_charging', 'motorcycle']).default('street'),
  capacity: z.number().int().min(1).default(1),
  primarySource: z.string(),
  confidence: z.number().min(0).max(1).optional(),
});

export const updateSpotAvailabilitySchema = z.object({
  spotId: z.string(),
  availableSpaces: z.number().int().min(0),
  changedBy: z.enum(['user', 'system', 'sensor']).default('user'),
  userId: z.string().optional(),
});

export const createSpotReportSchema = createInsertSchema(spotReports).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
  status: true,
}).extend({
  reportType: z.enum(['incorrect_location', 'no_longer_exists', 'wrong_regulations', 'hazard', 'other']),
});

// Types
export type ParkingSpot = typeof parkingSpots.$inferSelect;
export type InsertParkingSpot = z.infer<typeof insertParkingSpotSchema>;
export type UpdateSpotAvailability = z.infer<typeof updateSpotAvailabilitySchema>;
export type SpotAvailabilityHistory = typeof spotAvailabilityHistory.$inferSelect;
export type SpotReport = typeof spotReports.$inferSelect;
export type DataIngestionLog = typeof dataIngestionLogs.$inferSelect;
