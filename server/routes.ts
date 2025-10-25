import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertParkingSlotSchema } from "@shared/schema";
import { z } from "zod";

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
