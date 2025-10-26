import { sql } from "drizzle-orm";
import { pgTable, text, varchar, doublePrecision, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Existing user-reported parking slots
export const parkingSlots = pgTable("parking_slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  address: text("address").notNull(),
  notes: text("notes"),
  status: varchar("status", { length: 20 }).notNull().default("available"),
  postedAt: timestamp("posted_at").notNull().defaultNow(),

  // NEW: Enhanced fields for data source tracking
  source: varchar("source", { length: 50 }).notNull().default("user"), // 'user', 'sfpark', 'google', etc.
  confidence: doublePrecision("confidence").default(0.8), // 0-1 confidence score
  expiresAt: timestamp("expires_at"), // When this data becomes stale
  metadata: jsonb("metadata"), // Source-specific extra data
});

// NEW: External parking availability data (from APIs)
export const externalParkingData = pgTable("external_parking_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  source: varchar("source", { length: 50 }).notNull(), // 'sfpark', 'google_places', 'sf_opendata'
  externalId: varchar("external_id"), // ID from external system

  // Location info
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  address: text("address"),

  // Availability data
  type: varchar("type", { length: 50 }).notNull(), // 'street_segment', 'parking_lot', 'garage'
  totalSpaces: integer("total_spaces"), // Total capacity
  availableSpaces: integer("available_spaces"), // Currently available
  occupancyRate: doublePrecision("occupancy_rate"), // 0-1 (percentage full)

  // Metadata
  metadata: jsonb("metadata"), // Regulations, hours, pricing, etc.
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"), // Cache expiration

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// NEW: Parking regulations (from SF Open Data)
export const parkingRegulations = pgTable("parking_regulations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Location
  blockface: text("blockface"), // Street name + block
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),

  // Regulation info
  timeLimit: integer("time_limit"), // Minutes allowed
  days: varchar("days", { length: 100 }), // e.g., "Mon-Fri"
  hours: varchar("hours", { length: 100 }), // e.g., "8am-6pm"
  isMetered: varchar("is_metered", { length: 10 }).default("no"),
  isColorCurb: varchar("is_color_curb", { length: 20 }), // 'red', 'yellow', 'white', 'green', 'blue', 'none'

  // Metadata
  metadata: jsonb("metadata"),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

// Schemas
export const insertParkingSlotSchema = createInsertSchema(parkingSlots).omit({
  id: true,
  postedAt: true,
}).extend({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().min(1, "Address is required"),
  notes: z.string().optional(),
  status: z.enum(["available", "taken"]).default("available"),
  source: z.enum(["user", "sfpark", "google", "predicted"]).default("user"),
  confidence: z.number().min(0).max(1).optional(),
  expiresAt: z.date().optional(),
  metadata: z.any().optional(),
});

export const insertExternalParkingDataSchema = createInsertSchema(externalParkingData).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

export const insertParkingRegulationsSchema = createInsertSchema(parkingRegulations).omit({
  id: true,
  lastUpdated: true,
});

// Types
export type InsertParkingSlot = z.infer<typeof insertParkingSlotSchema>;
export type ParkingSlot = typeof parkingSlots.$inferSelect;
export type ExternalParkingData = typeof externalParkingData.$inferSelect;
export type ParkingRegulation = typeof parkingRegulations.$inferSelect;
