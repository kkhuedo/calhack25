import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertParkingSlotSchema } from "@shared/schema";
import { z } from "zod";
import { parkingAggregator } from "./services/parking-data/aggregator.service";

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

  // NEW: Get aggregated parking availability from multiple sources
  app.get("/api/parking-availability", async (req, res) => {
    try {
      // Validate query parameters
      const schema = z.object({
        latitude: z.string().transform(Number).pipe(z.number().min(-90).max(90)),
        longitude: z.string().transform(Number).pipe(z.number().min(-180).max(180)),
        radius: z.string().transform(Number).pipe(z.number().min(100).max(5000)).optional(),
      });

      const validated = schema.safeParse(req.query);

      if (!validated.success) {
        return res.status(400).json({
          error: "Invalid parameters",
          details: validated.error.errors,
        });
      }

      const { latitude, longitude, radius = 500 } = validated.data;

      // Get aggregated data
      const availability = await parkingAggregator.getParkingAvailability(
        { latitude, longitude },
        radius
      );

      res.json(availability);
    } catch (error) {
      console.error("Error fetching parking availability:", error);
      res.status(500).json({ error: "Failed to fetch parking availability" });
    }
  });

  app.get("/api/parking-slots", async (req, res) => {
    try {
      const slots = await storage.getParkingSlots();
      res.json(slots);
    } catch (error) {
      console.error("Error fetching parking slots:", error);
      res.status(500).json({ error: "Failed to fetch parking slots" });
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
