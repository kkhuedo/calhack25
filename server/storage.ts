import { type ParkingSlot, type InsertParkingSlot } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getParkingSlots(): Promise<ParkingSlot[]>;
  getParkingSlot(id: string): Promise<ParkingSlot | undefined>;
  createParkingSlot(slot: InsertParkingSlot): Promise<ParkingSlot>;
  updateParkingSlot(id: string, updates: Partial<InsertParkingSlot>): Promise<ParkingSlot | undefined>;
  deleteParkingSlot(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private parkingSlots: Map<string, ParkingSlot>;

  constructor() {
    this.parkingSlots = new Map();
  }

  async getParkingSlots(): Promise<ParkingSlot[]> {
    return Array.from(this.parkingSlots.values());
  }

  async getParkingSlot(id: string): Promise<ParkingSlot | undefined> {
    return this.parkingSlots.get(id);
  }

  async createParkingSlot(insertSlot: InsertParkingSlot): Promise<ParkingSlot> {
    const id = randomUUID();
    const slot: ParkingSlot = {
      id,
      latitude: insertSlot.latitude,
      longitude: insertSlot.longitude,
      address: insertSlot.address,
      notes: insertSlot.notes || null,
      status: insertSlot.status || "available",
      postedAt: new Date(),
    };
    this.parkingSlots.set(id, slot);
    return slot;
  }

  async updateParkingSlot(id: string, updates: Partial<InsertParkingSlot>): Promise<ParkingSlot | undefined> {
    const slot = this.parkingSlots.get(id);
    if (!slot) {
      return undefined;
    }

    const updatedSlot: ParkingSlot = {
      ...slot,
      ...updates,
    };
    this.parkingSlots.set(id, updatedSlot);
    return updatedSlot;
  }

  async deleteParkingSlot(id: string): Promise<boolean> {
    return this.parkingSlots.delete(id);
  }
}

export const storage = new MemStorage();
