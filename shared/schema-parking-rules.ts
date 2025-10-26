/**
 * Complete Parking Finder Schema for San Francisco
 * Stores regulations, meters, garages, events, and derived parking rules
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
  pgEnum,
  time,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// =============================================================================
// ENUMS
// =============================================================================

export const dayOfWeekEnum = pgEnum("day_of_week", [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]);

export const colorCurbEnum = pgEnum("color_curb", [
  "white",    // Passenger loading (5 min)
  "yellow",   // Commercial loading (30 min or as posted)
  "green",    // Short-term parking (10-30 min)
  "blue",     // Disabled parking (no time limit with placard)
  "red",      // No stopping/parking anytime
  "none",     // No painted curb
]);

// =============================================================================
// 1. PARKING REGULATIONS (from DataSF hi6h-neyh)
// =============================================================================

export const parkingRegulations = pgTable("parking_regulations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Location identifiers
  cnn: varchar("cnn", { length: 20 }).notNull(), // Centerline Network ID
  streetName: varchar("street_name", { length: 200 }).notNull(),
  fromStreet: varchar("from_street", { length: 200 }),
  toStreet: varchar("to_street", { length: 200 }),
  blockSide: varchar("block_side", { length: 10 }), // "L" or "R"

  // Geographic bounds (for spatial queries)
  geometry: jsonb("geometry").$type<{
    type: "LineString";
    coordinates: [number, number][];
  }>(), // GeoJSON LineString

  // Time restrictions
  weekDays: varchar("week_days", { length: 50 }), // e.g., "Mon-Fri", "Sat-Sun"
  timeStart: time("time_start"), // e.g., "08:00"
  timeEnd: time("time_end"), // e.g., "18:00"

  // Parking rules
  parkingCategory: varchar("parking_category", { length: 100 }), // "2HR", "NO PARKING", "RESIDENTIAL PERMIT", etc.
  timeLimitMinutes: integer("time_limit_minutes"), // NULL for no limit

  // Permit requirements
  permitArea: varchar("permit_area", { length: 20 }), // e.g., "Area R", "Area K"
  requiresPermit: boolean("requires_permit").default(false),

  // Street cleaning
  streetCleaningDay: varchar("street_cleaning_day", { length: 20 }), // "1st Tuesday", "2nd & 4th Monday"
  streetCleaningTimeStart: time("street_cleaning_time_start"),
  streetCleaningTimeEnd: time("street_cleaning_time_end"),

  // Colored curb
  colorCurb: colorCurbEnum("color_curb"),

  // Metered status
  isMetered: boolean("is_metered").default(false),

  // Metadata
  sourceDatasetId: varchar("source_dataset_id", { length: 50 }).default("hi6h-neyh"),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  metadata: jsonb("metadata"), // Store any additional fields from DataSF

}, (table) => ({
  cnnIdx: index("regulations_cnn_idx").on(table.cnn),
  streetIdx: index("regulations_street_idx").on(table.streetName),
  // For geospatial queries, you'd add a PostGIS index here if using PostGIS extension
}));

// =============================================================================
// 2. PARKING METERS (from DataSF 8vzz-qzz9)
// =============================================================================

export const parkingMeters = pgTable("parking_meters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Meter identifiers
  postId: varchar("post_id", { length: 50 }).notNull().unique(), // From DataSF
  meterId: varchar("meter_id", { length: 50 }),

  // Location
  streetName: varchar("street_name", { length: 200 }).notNull(),
  streetNumber: varchar("street_number", { length: 20 }),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),

  // Meter details
  meterType: varchar("meter_type", { length: 50 }), // "SS" (single space), "MS" (multi-space)
  smartMeter: boolean("smart_meter").default(false),
  capColor: varchar("cap_color", { length: 50 }), // Meter cap color
  activeMeter: boolean("active_meter").default(true),

  // Operational details
  onOffStreet: varchar("on_off_street", { length: 10 }), // "ON" or "OFF"
  rateArea: varchar("rate_area", { length: 50 }), // Rate zone

  // Related regulation
  cnn: varchar("cnn", { length: 20 }), // Links to parking_regulations

  // Metadata
  sourceDatasetId: varchar("source_dataset_id", { length: 50 }).default("8vzz-qzz9"),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  metadata: jsonb("metadata"),

}, (table) => ({
  locationIdx: index("meters_location_idx").on(table.latitude, table.longitude),
  postIdIdx: index("meters_post_id_idx").on(table.postId),
  cnnIdx: index("meters_cnn_idx").on(table.cnn),
}));

// =============================================================================
// 3. OFF-STREET PARKING (Garages/Lots from DataSF mizu-nf6z)
// =============================================================================

export const offStreetParking = pgTable("off_street_parking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Facility details
  facilityName: varchar("facility_name", { length: 200 }).notNull(),
  operatorName: varchar("operator_name", { length: 200 }),

  // Location
  address: text("address").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),

  // Capacity
  totalSpaces: integer("total_spaces"),
  accessibleSpaces: integer("accessible_spaces"),
  evChargingSpaces: integer("ev_charging_spaces"),

  // Operational hours
  operatingHours: jsonb("operating_hours").$type<{
    [day: string]: { open: string; close: string } | "closed";
  }>(), // e.g., { "Monday": { "open": "06:00", "close": "22:00" } }

  // Pricing
  hourlyRate: doublePrecision("hourly_rate"), // in dollars
  dailyMaxRate: doublePrecision("daily_max_rate"),
  monthlyRate: doublePrecision("monthly_rate"),

  // Features
  hasEvCharging: boolean("has_ev_charging").default(false),
  hasAccessibleParking: boolean("has_accessible_parking").default(false),
  isCovered: boolean("is_covered").default(false),
  securityFeatures: text("security_features"), // "Attended", "Camera", etc.

  // Payment
  paymentMethods: jsonb("payment_methods").$type<string[]>(), // ["credit_card", "cash", "app"]

  // Metadata
  sourceDatasetId: varchar("source_dataset_id", { length: 50 }).default("mizu-nf6z"),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  metadata: jsonb("metadata"),

}, (table) => ({
  locationIdx: index("offstreet_location_idx").on(table.latitude, table.longitude),
  nameIdx: index("offstreet_name_idx").on(table.facilityName),
}));

// =============================================================================
// 4. EVENTS (from iCal feeds)
// =============================================================================

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Event details
  eventName: text("event_name").notNull(),
  venueName: varchar("venue_name", { length: 200 }).notNull(),

  // Location
  venueAddress: text("venue_address"),
  venueLatitude: doublePrecision("venue_latitude").notNull(),
  venueLongitude: doublePrecision("venue_longitude").notNull(),

  // Timing
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  allDay: boolean("all_day").default(false),

  // Impact zone (parking affected within radius)
  impactRadiusMeters: integer("impact_radius_meters").default(500), // Default 500m radius

  // Expected impact
  expectedAttendance: integer("expected_attendance"),
  parkingDemandLevel: varchar("parking_demand_level", { length: 20 }), // "high", "medium", "low"

  // Source
  sourceCalendar: varchar("source_calendar", { length: 100 }).notNull(), // "chase_center", "oracle_park"
  externalId: varchar("external_id", { length: 200 }), // UID from iCal

  // Metadata
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  metadata: jsonb("metadata"),

}, (table) => ({
  venueIdx: index("events_venue_idx").on(table.venueName),
  timeIdx: index("events_time_idx").on(table.startTime, table.endTime),
  locationIdx: index("events_location_idx").on(table.venueLatitude, table.venueLongitude),
}));

// =============================================================================
// 5. COLORED CURB RULES (Hard-coded city-wide rules)
// =============================================================================

export const coloredCurbRules = pgTable("colored_curb_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Curb color
  colorCurb: colorCurbEnum("color_curb").notNull().unique(),

  // Rule description
  description: text("description").notNull(),
  timeLimitMinutes: integer("time_limit_minutes"), // NULL for no parking

  // Allowed uses
  allowedUses: jsonb("allowed_uses").$type<string[]>(), // ["passenger_loading", "commercial_loading", "disabled_parking"]

  // Enforcement
  enforced24_7: boolean("enforced_24_7").default(true),
  exceptions: text("exceptions"), // Human-readable exceptions

  // Metadata
  sourceUrl: varchar("source_url", { length: 500 }), // SFMTA reference
  lastVerified: timestamp("last_verified").notNull().defaultNow(),
});

// =============================================================================
// 6. METER RATES (Pricing by area and time)
// =============================================================================

export const meterRates = pgTable("meter_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Rate area
  rateArea: varchar("rate_area", { length: 50 }).notNull(),

  // Time-based pricing
  weekDays: varchar("week_days", { length: 50 }).notNull(), // "Mon-Fri", "Sat", "Sun"
  timeStart: time("time_start").notNull(),
  timeEnd: time("time_end").notNull(),

  // Rate
  hourlyRate: doublePrecision("hourly_rate").notNull(), // in dollars

  // Enforcement
  timeLimit: integer("time_limit_minutes"), // Max parking duration

  // Metadata
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),

}, (table) => ({
  rateAreaIdx: index("meter_rates_area_idx").on(table.rateArea),
}));

// =============================================================================
// 7. DATA SYNC LOG (Track ingestion runs)
// =============================================================================

export const dataSyncLog = pgTable("data_sync_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Sync details
  datasetId: varchar("dataset_id", { length: 100 }).notNull(), // "hi6h-neyh", "8vzz-qzz9", etc.
  datasetName: varchar("dataset_name", { length: 200 }).notNull(),

  // Status
  status: varchar("status", { length: 20 }).notNull(), // "success", "failed", "in_progress"
  recordsProcessed: integer("records_processed").default(0),
  recordsInserted: integer("records_inserted").default(0),
  recordsUpdated: integer("records_updated").default(0),
  recordsSkipped: integer("records_skipped").default(0),

  // Timing
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),

  // Error handling
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),

}, (table) => ({
  datasetIdx: index("sync_log_dataset_idx").on(table.datasetId),
  statusIdx: index("sync_log_status_idx").on(table.status),
}));

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

export const insertParkingRegulationSchema = createInsertSchema(parkingRegulations).omit({
  id: true,
  lastUpdated: true,
});

export const insertParkingMeterSchema = createInsertSchema(parkingMeters).omit({
  id: true,
  lastUpdated: true,
});

export const insertOffStreetParkingSchema = createInsertSchema(offStreetParking).omit({
  id: true,
  lastUpdated: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  lastUpdated: true,
});

export const insertColoredCurbRuleSchema = createInsertSchema(coloredCurbRules).omit({
  id: true,
  lastVerified: true,
});

export const insertMeterRateSchema = createInsertSchema(meterRates).omit({
  id: true,
  lastUpdated: true,
});

// =============================================================================
// TYPES
// =============================================================================

export type ParkingRegulation = typeof parkingRegulations.$inferSelect;
export type InsertParkingRegulation = z.infer<typeof insertParkingRegulationSchema>;

export type ParkingMeter = typeof parkingMeters.$inferSelect;
export type InsertParkingMeter = z.infer<typeof insertParkingMeterSchema>;

export type OffStreetParking = typeof offStreetParking.$inferSelect;
export type InsertOffStreetParking = z.infer<typeof insertOffStreetParkingSchema>;

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export type ColoredCurbRule = typeof coloredCurbRules.$inferSelect;
export type InsertColoredCurbRule = z.infer<typeof insertColoredCurbRuleSchema>;

export type MeterRate = typeof meterRates.$inferSelect;
export type InsertMeterRate = z.infer<typeof insertMeterRateSchema>;

export type DataSyncLog = typeof dataSyncLog.$inferSelect;
