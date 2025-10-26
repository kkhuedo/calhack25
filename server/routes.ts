import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertParkingSlotSchema } from "@shared/schema";
import { z } from "zod";
import { calculateDistance } from "./geo-utils";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  const broadcast = (data: any) => {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  wss.on("connection", (ws) => {
    console.log("New WebSocket client connected");

    ws.on("close", () => {
      console.log("WebSocket client disconnected");
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

  app.get("/health", async (_req, res) => {
    try {
      await storage.getParkingSlots();
      res.status(200).json({ status: "ok", database: "connected" });
    } catch (error) {
      console.error("Health check failed:", error);
      res.status(503).json({ status: "error", database: "disconnected" });
    }
  });

  app.get("/api/parking-slots", async (req, res) => {
    try {
      // Support optional radius filtering for performance
      const lat = req.query.lat ? parseFloat(req.query.lat as string) : null;
      const lon = req.query.lon ? parseFloat(req.query.lon as string) : null;
      const radiusMiles = req.query.radius ? parseFloat(req.query.radius as string) : null;

      // Get all slots first
      let slots = await storage.getParkingSlots();

      // Apply filters
      const filters = {
        minSafety: req.query.minSafety ? parseInt(req.query.minSafety as string) : null,
        maxSafety: req.query.maxSafety ? parseInt(req.query.maxSafety as string) : null,
        hasLighting: req.query.hasLighting === "true" ? true : null,
        hasSecurityCamera: req.query.hasSecurityCamera === "true" ? true : null,
        nearbyEvents: req.query.nearbyEvents === "true" ? true : req.query.nearbyEvents === "false" ? false : null,
        highDemandArea: req.query.highDemandArea === "true" ? true : req.query.highDemandArea === "false" ? false : null,
        demandLevel: req.query.demandLevel as string | null,
        priceCategory: req.query.priceCategory as string | null,
        maxHourlyRate: req.query.maxHourlyRate ? parseFloat(req.query.maxHourlyRate as string) : null,
        handicapAccessible: req.query.handicapAccessible === "true" ? true : null,
        evCharging: req.query.evCharging === "true" ? true : null,
        spotType: req.query.spotType as string | null,
        verified: req.query.verified === "true" ? true : req.query.verified === "false" ? false : null,
      };

      // Apply all filters
      slots = slots.filter(slot => {
        if (filters.minSafety && (slot.safetyScore || 0) < filters.minSafety) return false;
        if (filters.maxSafety && (slot.safetyScore || 10) > filters.maxSafety) return false;
        if (filters.hasLighting !== null && slot.hasLighting !== filters.hasLighting) return false;
        if (filters.hasSecurityCamera !== null && slot.hasSecurityCamera !== filters.hasSecurityCamera) return false;
        if (filters.nearbyEvents !== null && slot.nearbyEvents !== filters.nearbyEvents) return false;
        if (filters.highDemandArea !== null && slot.highDemandArea !== filters.highDemandArea) return false;
        if (filters.demandLevel && slot.demandLevel !== filters.demandLevel) return false;
        if (filters.priceCategory && slot.priceCategory !== filters.priceCategory) return false;
        if (filters.maxHourlyRate && slot.hourlyRate && slot.hourlyRate > filters.maxHourlyRate) return false;
        if (filters.handicapAccessible !== null && slot.handicapAccessible !== filters.handicapAccessible) return false;
        if (filters.evCharging !== null && slot.evCharging !== filters.evCharging) return false;
        if (filters.spotType && slot.spotType !== filters.spotType) return false;
        if (filters.verified !== null && slot.verified !== filters.verified) return false;
        return true;
      });

      if (lat && lon && radiusMiles && !isNaN(lat) && !isNaN(lon) && !isNaN(radiusMiles)) {
        // Use the nearby endpoint logic
        const radiusMeters = radiusMiles * 1609.34;
        const nearbySlots = slots
          .map(slot => {
            const distance = calculateDistance(lat, lon, slot.latitude, slot.longitude);
            return { ...slot, distance };
          })
          .filter(slot => slot.distance <= radiusMeters)
          .sort((a, b) => a.distance - b.distance);

        return res.json({
          center: { latitude: lat, longitude: lon },
          radius: radiusMiles,
          count: nearbySlots.length,
          slots: nearbySlots
        });
      }

      // If no radius filter, return limited results (prevents loading 100k+ records)
      const limit = parseInt(req.query.limit as string) || 50; // Default to 50 for faster loads
      const limitedSlots = slots.slice(0, limit);

      // Return array directly for backward compatibility with frontend
      res.json(limitedSlots);
    } catch (error) {
      console.error("Error fetching parking slots:", error);
      res.status(500).json({ error: "Failed to fetch parking slots" });
    }
  });

  // Get parking spots within a radius (in miles) - optimized for radius-based queries
  app.get("/api/parking-slots/nearby", async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lon = parseFloat(req.query.lon as string);
      const radiusMiles = parseFloat(req.query.radius as string) || 1.0; // default 1 mile
      const limit = parseInt(req.query.limit as string) || 100;

      if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ error: "Invalid latitude or longitude" });
      }

      // Use nearby storage method if available for better performance
      const slots = await storage.getParkingSlots();
      
      // Filter slots within radius (1 mile ≈ 1609.34 meters)
      const radiusMeters = radiusMiles * 1609.34;
      const nearbySlots = slots
        .map(slot => {
          const distance = calculateDistance(lat, lon, slot.latitude, slot.longitude);
          return { ...slot, distance };
        })
        .filter(slot => slot.distance <= radiusMeters)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit); // Limit results

      res.json({
        center: { latitude: lat, longitude: lon },
        radius: radiusMiles,
        count: nearbySlots.length,
        limit,
        slots: nearbySlots
      });
    } catch (error) {
      console.error("Error fetching nearby parking slots:", error);
      res.status(500).json({ error: "Failed to fetch nearby parking slots" });
    }
  });

  app.get("/api/parking-slots/:id", async (req, res) => {
    try {
      const slot = await storage.getParkingSlot(req.params.id);
      if (!slot) {
        return res.status(404).json({ error: "Parking slot not found" });
      }
      res.json(slot);
    } catch (error) {
      console.error("Error fetching parking slot:", error);
      res.status(500).json({ error: "Failed to fetch parking slot" });
    }
  });

  // Two-tier spot discovery endpoint
  app.post("/api/parking-slots/report", async (req, res) => {
    try {
      const reportSchema = z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        status: z.enum(["available", "taken"]),
        userId: z.string().optional(),
      });

      const validatedData = reportSchema.parse(req.body);
      const result = await storage.reportParkingSpot(
        validatedData.latitude,
        validatedData.longitude,
        validatedData.status,
        validatedData.userId
      );

      // Broadcast appropriate event
      if (result.isNewDiscovery) {
        broadcast({
          type: "spot_discovered",
          data: result.spot,
        });
      } else {
        broadcast({
          type: "slot_updated",
          data: result.spot,
        });
      }

      res.status(result.isNewDiscovery ? 201 : 200).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error reporting parking spot:", error);
      res.status(500).json({ error: "Failed to report parking spot" });
    }
  });

  // Confirm unverified spot endpoint
  app.post("/api/parking-slots/:id/confirm", async (req, res) => {
    try {
      const confirmSchema = z.object({
        userId: z.string().optional(),
      });

      const validatedData = confirmSchema.parse(req.body);
      const updatedSlot = await storage.confirmParkingSpot(req.params.id, validatedData.userId);

      if (!updatedSlot) {
        return res.status(404).json({ error: "Parking slot not found" });
      }

      broadcast({
        type: "slot_confirmed",
        data: updatedSlot,
      });

      res.json({
        spot: updatedSlot,
        message: updatedSlot.verified
          ? "Spot verified! Thanks for confirming."
          : `Spot confirmed (${updatedSlot.userConfirmations}/3 confirmations)`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error confirming parking spot:", error);
      res.status(500).json({ error: "Failed to confirm parking spot" });
    }
  });

  app.post("/api/parking-slots", async (req, res) => {
    try {
      const validatedData = insertParkingSlotSchema.parse(req.body);
      const newSlot = await storage.createParkingSlot(validatedData);

      broadcast({
        type: "slot_created",
        data: newSlot,
      });

      res.status(201).json(newSlot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating parking slot:", error);
      res.status(500).json({ error: "Failed to create parking slot" });
    }
  });

  app.patch("/api/parking-slots/:id", async (req, res) => {
    try {
      const patchSchema = z.object({
        notes: z.string().optional(),
        status: z.enum(["available", "taken"]).optional(),
      }).strict();
      
      const validatedData = patchSchema.parse(req.body);
      
      const updatedSlot = await storage.updateParkingSlot(req.params.id, validatedData);
      
      if (!updatedSlot) {
        return res.status(404).json({ error: "Parking slot not found" });
      }

      broadcast({
        type: "slot_updated",
        data: updatedSlot,
      });

      res.json(updatedSlot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating parking slot:", error);
      res.status(500).json({ error: "Failed to update parking slot" });
    }
  });

  app.delete("/api/parking-slots/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteParkingSlot(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Parking slot not found" });
      }

      broadcast({
        type: "slot_deleted",
        data: { id: req.params.id },
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting parking slot:", error);
      res.status(500).json({ error: "Failed to delete parking slot" });
    }
  });

  return httpServer;
}
