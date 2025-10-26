import { parkingSlots, type ParkingSlot, type InsertParkingSlot } from "@shared/schema";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { findClosestSpot } from "./geo-utils";

export interface SpotReportResult {
  spot: ParkingSlot;
  isNewDiscovery: boolean;
  distance?: number;
  message: string;
  pointsEarned?: number;
}

export interface IStorage {
  getParkingSlots(): Promise<ParkingSlot[]>;
  getParkingSlot(id: string): Promise<ParkingSlot | undefined>;
  createParkingSlot(slot: InsertParkingSlot): Promise<ParkingSlot>;
  updateParkingSlot(id: string, updates: Partial<InsertParkingSlot>): Promise<ParkingSlot | undefined>;
  deleteParkingSlot(id: string): Promise<boolean>;
  reportParkingSpot(latitude: number, longitude: number, status: 'available' | 'taken', userId?: string): Promise<SpotReportResult>;
  confirmParkingSpot(id: string, userId?: string): Promise<ParkingSlot | undefined>;
}

// In-memory storage for development without database
export class MemoryStorage implements IStorage {
  private slots: Map<string, ParkingSlot> = new Map();

  async getParkingSlots(): Promise<ParkingSlot[]> {
    return Array.from(this.slots.values());
  }

  async getParkingSlot(id: string): Promise<ParkingSlot | undefined> {
    return this.slots.get(id);
  }

  async createParkingSlot(insertSlot: InsertParkingSlot): Promise<ParkingSlot> {
    const slot: ParkingSlot = {
      id: randomUUID(),
      latitude: insertSlot.latitude,
      longitude: insertSlot.longitude,
      address: insertSlot.address,
      notes: insertSlot.notes || null,
      status: insertSlot.status || "available",
      postedAt: new Date(),
    };
    this.slots.set(slot.id, slot);
    return slot;
  }

  async updateParkingSlot(id: string, updates: Partial<InsertParkingSlot>): Promise<ParkingSlot | undefined> {
    const existing = this.slots.get(id);
    if (!existing) return undefined;

    const updated: ParkingSlot = {
      ...existing,
      ...updates,
      id: existing.id,
      postedAt: existing.postedAt,
    };
    this.slots.set(id, updated);
    return updated;
  }

  async deleteParkingSlot(id: string): Promise<boolean> {
    return this.slots.delete(id);
  }

  async reportParkingSpot(
    latitude: number,
    longitude: number,
    status: 'available' | 'taken',
    userId?: string
  ): Promise<SpotReportResult> {
    const allSlots = Array.from(this.slots.values());
    const nearby = findClosestSpot(latitude, longitude, allSlots, 20);

    if (nearby) {
      // EXISTING SPOT - Update status
      const updated = await this.updateParkingSlot(nearby.spot.id, {
        status,
        currentlyAvailable: status === 'available',
        confidenceScore: 95,
      });

      return {
        spot: updated!,
        isNewDiscovery: false,
        distance: nearby.distance,
        message: 'Spot status updated',
      };
    } else {
      // NEW SPOT DISCOVERY
      const newSlot = await this.createParkingSlot({
        latitude,
        longitude,
        address: 'User-discovered location', // Will be geocoded by frontend
        status,
        spotType: 'user_discovered',
        dataSource: 'user_report',
        verified: false,
        confidenceScore: 70,
        userConfirmations: 1,
        firstReportedBy: userId,
        currentlyAvailable: status === 'available',
      });

      return {
        spot: newSlot,
        isNewDiscovery: true,
        message: 'New parking spot discovered!',
        pointsEarned: 20,
      };
    }
  }

  async confirmParkingSpot(id: string, userId?: string): Promise<ParkingSlot | undefined> {
    const existing = this.slots.get(id);
    if (!existing) return undefined;

    const newConfirmations = (existing.userConfirmations || 0) + 1;
    const shouldVerify = newConfirmations >= 3;

    return await this.updateParkingSlot(id, {
      userConfirmations: newConfirmations,
      verified: shouldVerify ? true : existing.verified,
      confidenceScore: shouldVerify ? 95 : existing.confidenceScore,
    });
  }
}

export class DatabaseStorage implements IStorage {
  async getParkingSlots(): Promise<ParkingSlot[]> {
    if (!db) throw new Error("Database not configured. Set DATABASE_URL or use MemoryStorage.");
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

  async reportParkingSpot(
    latitude: number,
    longitude: number,
    status: 'available' | 'taken',
    userId?: string
  ): Promise<SpotReportResult> {
    // Get all slots and find nearby (in production, you'd use PostGIS for this)
    const allSlots = await this.getParkingSlots();
    const nearby = findClosestSpot(latitude, longitude, allSlots, 20);

    if (nearby) {
      // EXISTING SPOT - Update status
      const updated = await this.updateParkingSlot(nearby.spot.id, {
        status,
        currentlyAvailable: status === 'available',
        confidenceScore: 95,
      });

      return {
        spot: updated!,
        isNewDiscovery: false,
        distance: nearby.distance,
        message: 'Spot status updated',
      };
    } else {
      // NEW SPOT DISCOVERY
      const newSlot = await this.createParkingSlot({
        latitude,
        longitude,
        address: 'User-discovered location', // Will be geocoded by frontend
        status,
        spotType: 'user_discovered',
        dataSource: 'user_report',
        verified: false,
        confidenceScore: 70,
        userConfirmations: 1,
        firstReportedBy: userId,
        currentlyAvailable: status === 'available',
      });

      return {
        spot: newSlot,
        isNewDiscovery: true,
        message: 'New parking spot discovered!',
        pointsEarned: 20,
      };
    }
  }

  async confirmParkingSpot(id: string, userId?: string): Promise<ParkingSlot | undefined> {
    const existing = await this.getParkingSlot(id);
    if (!existing) return undefined;

    const newConfirmations = (existing.userConfirmations || 0) + 1;
    const shouldVerify = newConfirmations >= 3;

    return await this.updateParkingSlot(id, {
      userConfirmations: newConfirmations,
      verified: shouldVerify ? true : existing.verified,
      confidenceScore: shouldVerify ? 95 : existing.confidenceScore,
    });
  }
}

// Use MemoryStorage for development without database
// Switch to DatabaseStorage when you're ready to use PostgreSQL
export const storage = new MemoryStorage();
// export const storage = new DatabaseStorage();
