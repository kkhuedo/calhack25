import { sql } from "drizzle-orm";
import { pgTable, text, varchar, doublePrecision, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const parkingSlots = pgTable("parking_slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  address: text("address").notNull(),
  notes: text("notes"),
  status: varchar("status", { length: 20 }).notNull().default("available"),
  postedAt: timestamp("posted_at").notNull().defaultNow(),
});

export const insertParkingSlotSchema = createInsertSchema(parkingSlots).omit({
  id: true,
  postedAt: true,
}).extend({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().min(1, "Address is required"),
  notes: z.string().optional(),
  status: z.enum(["available", "taken"]).default("available"),
});

export type InsertParkingSlot = z.infer<typeof insertParkingSlotSchema>;
export type ParkingSlot = typeof parkingSlots.$inferSelect;
