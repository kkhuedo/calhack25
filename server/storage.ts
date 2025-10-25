import { parkingSlots, type ParkingSlot, type InsertParkingSlot } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getParkingSlots(): Promise<ParkingSlot[]>;
  getParkingSlot(id: string): Promise<ParkingSlot | undefined>;
  createParkingSlot(slot: InsertParkingSlot): Promise<ParkingSlot>;
  updateParkingSlot(id: string, updates: Partial<InsertParkingSlot>): Promise<ParkingSlot | undefined>;
  deleteParkingSlot(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getParkingSlots(): Promise<ParkingSlot[]> {
    return await db.select().from(parkingSlots);
  }

  async getParkingSlot(id: string): Promise<ParkingSlot | undefined> {
    const [slot] = await db.select().from(parkingSlots).where(eq(parkingSlots.id, id));
    return slot || undefined;
  }

  async createParkingSlot(insertSlot: InsertParkingSlot): Promise<ParkingSlot> {
    const [slot] = await db
      .insert(parkingSlots)
      .values(insertSlot)
      .returning();
    return slot;
  }

  async updateParkingSlot(id: string, updates: Partial<InsertParkingSlot>): Promise<ParkingSlot | undefined> {
    const [updatedSlot] = await db
      .update(parkingSlots)
      .set(updates)
      .where(eq(parkingSlots.id, id))
      .returning();
    return updatedSlot || undefined;
  }

  async deleteParkingSlot(id: string): Promise<boolean> {
    const result = await db
      .delete(parkingSlots)
      .where(eq(parkingSlots.id, id))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
