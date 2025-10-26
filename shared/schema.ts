import { sql } from "drizzle-orm";
import { pgTable, text, varchar, doublePrecision, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const parkingSlots = pgTable("parking_slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  address: text("address").notNull(),
  notes: text("notes"),

  // Legacy status field (keeping for backward compatibility)
  status: varchar("status", { length: 20 }).notNull().default("available"),

  // Two-tier system fields
  spotType: varchar("spot_type", { length: 50 }).notNull().default("user_discovered"),
  dataSource: varchar("data_source", { length: 50 }).notNull().default("user_report"),
  verified: boolean("verified").notNull().default(false),
  confidenceScore: integer("confidence_score").notNull().default(70),

  // Crowdsourced validation
  userConfirmations: integer("user_confirmations").notNull().default(0),
  firstReportedBy: varchar("first_reported_by", { length: 255 }), // user_id (nullable for now)
  firstReportedAt: timestamp("first_reported_at").defaultNow(),

  // Metadata
  restrictions: jsonb("restrictions"), // time limits, permits, sweeping schedules
  spotCount: integer("spot_count").notNull().default(1), // how many spots at this location

  // Current availability
  currentlyAvailable: boolean("currently_available").notNull().default(true),
  lastUpdated: timestamp("last_updated").defaultNow(),

  postedAt: timestamp("posted_at").notNull().defaultNow(),
});

export const insertParkingSlotSchema = createInsertSchema(parkingSlots).omit({
  id: true,
  postedAt: true,
  lastUpdated: true,
  firstReportedAt: true,
}).extend({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().min(1, "Address is required"),
  notes: z.string().optional(),
  status: z.enum(["available", "taken"]).default("available"),
  spotType: z.enum(["metered", "public_lot", "garage", "street", "user_discovered"]).default("user_discovered"),
  dataSource: z.enum(["sf_open_data", "google_places", "openstreetmap", "user_report"]).default("user_report"),
  verified: z.boolean().default(false),
  confidenceScore: z.number().min(0).max(100).default(70),
  userConfirmations: z.number().min(0).default(0),
  firstReportedBy: z.string().optional(),
  restrictions: z.record(z.any()).optional(),
  spotCount: z.number().min(1).default(1),
  currentlyAvailable: z.boolean().default(true),
});

export type InsertParkingSlot = z.infer<typeof insertParkingSlotSchema>;
export type ParkingSlot = typeof parkingSlots.$inferSelect;
