# 🅿️ San Francisco Parking Finder - Complete Implementation Guide

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Data Seeding Strategy](#data-seeding-strategy)
4. [API Endpoints](#api-endpoints)
5. [Rule Engine Logic](#rule-engine-logic)
6. [Implementation Steps](#implementation-steps)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              DATA SOURCES (Static Base Layer)           │
├─────────────────────────────────────────────────────────┤
│  • DataSF: Parking Regulations (hi6h-neyh)             │
│  • DataSF: Parking Meters (8vzz-qzz9)                  │
│  • DataSF: Off-Street Parking (mizu-nf6z)              │
│  • iCal: Event Calendars (Chase Center, Oracle Park)   │
│  • Hard-coded: Colored Curb Rules                      │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│              SEEDER SCRIPTS (One-time import)           │
├─────────────────────────────────────────────────────────┤
│  • regulations-seeder.ts  → parking_regulations table  │
│  • meters-seeder.ts       → parking_meters table       │
│  • garages-seeder.ts      → off_street_parking table   │
│  • events-seeder.ts       → events table               │
│  • curb-rules-seeder.ts   → colored_curb_rules table   │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│              POSTGRES DATABASE (Neon)                   │
├─────────────────────────────────────────────────────────┤
│  • 7 tables storing all parking data                   │
│  • Spatial indexes for lat/lon queries                 │
│  • Temporal indexes for time-based rules               │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│              RULE ENGINE API                            │
├─────────────────────────────────────────────────────────┤
│  POST /api/parking/rules                               │
│  Input: { lat, lon, datetime }                         │
│  Output: Consolidated parking rules + recommendations  │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│              REACT FRONTEND                             │
├─────────────────────────────────────────────────────────┤
│  • Map showing rules at any location                   │
│  • "Tap here to see parking rules"                     │
│  • Real-time event impact warnings                     │
└─────────────────────────────────────────────────────────┘
```

---

## Database Schema

**File:** `/shared/schema-parking-rules.ts`

### Tables Created:

1. **`parking_regulations`** - Street-by-street rules from DataSF
   - Time limits, street cleaning, permit zones
   - Links to street segments via CNN (Centerline Network ID)

2. **`parking_meters`** - Individual meter locations
   - GPS coordinates, meter types, rate areas
   - Links to regulations via CNN

3. **`off_street_parking`** - City-owned garages and lots
   - Capacity, hours, pricing, amenities

4. **`events`** - Major venue events from iCal feeds
   - Start/end times, impact radius, demand level

5. **`colored_curb_rules`** - Hard-coded SF-wide curb rules
   - White=5min passenger, Yellow=30min commercial, etc.

6. **`meter_rates`** - Time-based pricing by rate area
   - Different rates for peak/off-peak hours

7. **`data_sync_log`** - Track seeding runs
   - Success/failure, record counts, timestamps

---

## Data Seeding Strategy

### File Structure:

```
server/services/seeding/
├── datasf-client.ts           # API client for DataSF
├── ical-parser.ts             # iCal event parser
├── seeders/
│   ├── regulations-seeder.ts  # Seed parking regulations
│   ├── meters-seeder.ts       # Seed parking meters
│   ├── garages-seeder.ts      # Seed off-street parking
│   ├── events-seeder.ts       # Seed event calendar
│   └── curb-rules-seeder.ts   # Seed colored curb rules
└── orchestrator.ts            # Main seeding script

scripts/
└── seed-parking-rules.ts      # CLI entry point
```

### Seeding Implementation:

#### 1. Regulations Seeder (`regulations-seeder.ts`)

```typescript
import { dataSFClient } from "../datasf-client";
import { db } from "../../../db";
import { parkingRegulations, dataSyncLog } from "../../../../shared/schema-parking-rules";

interface DataSFRegulation {
  cnn: string;
  street_name: string;
  from_street: string;
  to_street: string;
  block_side: string;
  week_days: string;
  time_start: string;
  time_end: string;
  parking_category: string;
  time_limit_minutes: string;
  permit_area: string;
  street_cleaning_day: string;
  color_curb: string;
  the_geom: any; // GeoJSON geometry
}

export async function seedRegulations(): Promise<void> {
  const logId = crypto.randomUUID();

  console.log("\n═══════════════════════════════════════════════");
  console.log("  SEEDING: Parking Regulations (hi6h-neyh)");
  console.log("═══════════════════════════════════════════════\n");

  try {
    await db.insert(dataSyncLog).values({
      id: logId,
      datasetId: "hi6h-neyh",
      datasetName: "Parking Regulations",
      status: "in_progress",
      startedAt: new Date(),
    });

    // Fetch all regulations from DataSF
    const rawData = await dataSFClient.fetchAll<DataSFRegulation>("hi6h-neyh", {
      where: "parking_category IS NOT NULL",
      order: "cnn ASC",
    });

    console.log(`\nTransforming ${rawData.length} regulations...`);

    const regulations = rawData.map(reg => ({
      cnn: reg.cnn,
      streetName: reg.street_name,
      fromStreet: reg.from_street,
      toStreet: reg.to_street,
      blockSide: reg.block_side,
      geometry: reg.the_geom,
      weekDays: reg.week_days,
      timeStart: reg.time_start,
      timeEnd: reg.time_end,
      parkingCategory: reg.parking_category,
      timeLimitMinutes: reg.time_limit_minutes ? parseInt(reg.time_limit_minutes) : null,
      permitArea: reg.permit_area,
      requiresPermit: !!reg.permit_area,
      streetCleaningDay: reg.street_cleaning_day,
      colorCurb: reg.color_curb as any,
      isMetered: reg.parking_category?.includes("METER") || false,
    }));

    // Batch insert
    console.log("\nInserting into database...");
    const batchSize = 500;

    for (let i = 0; i < regulations.length; i += batchSize) {
      const batch = regulations.slice(i, i + batchSize);
      await db.insert(parkingRegulations).values(batch);
      console.log(`  Inserted ${Math.min(i + batchSize, regulations.length)} / ${regulations.length}`);
    }

    await db.update(dataSyncLog)
      .set({
        status: "success",
        recordsProcessed: rawData.length,
        recordsInserted: regulations.length,
        completedAt: new Date(),
      })
      .where(db => db.id === logId);

    console.log("\n✅ Regulations seeded successfully!\n");

  } catch (error: any) {
    console.error("\n❌ Regulations seeding failed:", error.message);

    await db.update(dataSyncLog)
      .set({
        status: "failed",
        errorMessage: error.message,
        completedAt: new Date(),
      })
      .where(db => db.id === logId);

    throw error;
  }
}
```

#### 2. Meters Seeder (`meters-seeder.ts`)

```typescript
import { dataSFClient } from "../datasf-client";
import { db } from "../../../db";
import { parkingMeters, dataSyncLog } from "../../../../shared/schema-parking-rules";

interface DataSFMeter {
  post_id: string;
  meter_id: string;
  street_name: string;
  street_num: string;
  latitude: string;
  longitude: string;
  meter_type: string;
  smart_mete: string; // "Y" or "N"
  cap_color: string;
  active_meter_flag: string;
  on_offstreet_type: string;
  rate_area: string;
  clr_guid: string; // CNN
}

export async function seedMeters(): Promise<void> {
  const logId = crypto.randomUUID();

  console.log("\n═══════════════════════════════════════════════");
  console.log("  SEEDING: Parking Meters (8vzz-qzz9)");
  console.log("═══════════════════════════════════════════════\n");

  try {
    await db.insert(dataSyncLog).values({
      id: logId,
      datasetId: "8vzz-qzz9",
      datasetName: "Parking Meters",
      status: "in_progress",
      startedAt: new Date(),
    });

    // Fetch only active meters
    const rawData = await dataSFClient.fetchAll<DataSFMeter>("8vzz-qzz9", {
      where: "active_meter_flag='Y'",
      order: "post_id ASC",
    });

    console.log(`\nTransforming ${rawData.length} meters...`);

    const meters = rawData
      .filter(m => m.latitude && m.longitude) // Skip meters without coordinates
      .map(meter => ({
        postId: meter.post_id,
        meterId: meter.meter_id,
        streetName: meter.street_name,
        streetNumber: meter.street_num,
        latitude: parseFloat(meter.latitude),
        longitude: parseFloat(meter.longitude),
        meterType: meter.meter_type,
        smartMeter: meter.smart_mete === "Y",
        capColor: meter.cap_color,
        activeMeter: meter.active_meter_flag === "Y",
        onOffStreet: meter.on_offstreet_type,
        rateArea: meter.rate_area,
        cnn: meter.clr_guid,
      }));

    // Batch insert
    console.log("\nInserting into database...");
    const batchSize = 500;

    for (let i = 0; i < meters.length; i += batchSize) {
      const batch = meters.slice(i, i + batchSize);
      await db.insert(parkingMeters).values(batch);
      console.log(`  Inserted ${Math.min(i + batchSize, meters.length)} / ${meters.length}`);
    }

    await db.update(dataSyncLog)
      .set({
        status: "success",
        recordsProcessed: rawData.length,
        recordsInserted: meters.length,
        completedAt: new Date(),
      })
      .where(db => db.id === logId);

    console.log("\n✅ Meters seeded successfully!\n");

  } catch (error: any) {
    console.error("\n❌ Meters seeding failed:", error.message);

    await db.update(dataSyncLog)
      .set({
        status: "failed",
        errorMessage: error.message,
        completedAt: new Date(),
      })
      .where(db => db.id === logId);

    throw error;
  }
}
```

#### 3. Events Seeder (`events-seeder.ts`)

```typescript
import { parseICalendar } from "../ical-parser";
import { db } from "../../../db";
import { events, dataSyncLog } from "../../../../shared/schema-parking-rules";

const EVENT_VENUES = [
  {
    name: "Chase Center",
    calendarUrl: "https://www.chasecenter.com/events/calendar.ics",
    latitude: 37.7679,
    longitude: -122.3874,
    impactRadius: 800, // meters
  },
  {
    name: "Oracle Park",
    calendarUrl: "https://www.mlb.com/giants/tickets/calendar.ics",
    latitude: 37.7786,
    longitude: -122.3893,
    impactRadius: 600,
  },
];

export async function seedEvents(): Promise<void> {
  const logId = crypto.randomUUID();

  console.log("\n═══════════════════════════════════════════════");
  console.log("  SEEDING: Event Calendars");
  console.log("═══════════════════════════════════════════════\n");

  try {
    await db.insert(dataSyncLog).values({
      id: logId,
      datasetId: "ical_events",
      datasetName: "Event Calendars",
      status: "in_progress",
      startedAt: new Date(),
    });

    const allEvents = [];

    for (const venue of EVENT_VENUES) {
      console.log(`\nFetching events from ${venue.name}...`);

      try {
        const icalEvents = await parseICalendar(venue.calendarUrl);

        console.log(`  Found ${icalEvents.length} events`);

        const transformed = icalEvents.map(event => ({
          eventName: event.summary,
          venueName: venue.name,
          venueAddress: event.location || undefined,
          venueLatitude: venue.latitude,
          venueLongitude: venue.longitude,
          startTime: event.start,
          endTime: event.end,
          allDay: event.allDay || false,
          impactRadiusMeters: venue.impactRadius,
          expectedAttendance: event.attendees || undefined,
          parkingDemandLevel: estimateDemandLevel(event.summary),
          sourceCalendar: venue.name.toLowerCase().replace(/\s+/g, "_"),
          externalId: event.uid,
        }));

        allEvents.push(...transformed);

      } catch (error: any) {
        console.error(`  ⚠️  Failed to fetch ${venue.name}: ${error.message}`);
      }
    }

    if (allEvents.length > 0) {
      console.log(`\nInserting ${allEvents.length} events into database...`);
      await db.insert(events).values(allEvents);
    }

    await db.update(dataSyncLog)
      .set({
        status: "success",
        recordsProcessed: allEvents.length,
        recordsInserted: allEvents.length,
        completedAt: new Date(),
      })
      .where(db => db.id === logId);

    console.log("\n✅ Events seeded successfully!\n");

  } catch (error: any) {
    console.error("\n❌ Events seeding failed:", error.message);

    await db.update(dataSyncLog)
      .set({
        status: "failed",
        errorMessage: error.message,
        completedAt: new Date(),
      })
      .where(db => db.id === logId);

    throw error;
  }
}

function estimateDemandLevel(eventName: string): "high" | "medium" | "low" {
  const highDemand = ["playoff", "championship", "concert", "finals"];
  const mediumDemand = ["game", "match", "performance"];

  const lowerName = eventName.toLowerCase();

  if (highDemand.some(keyword => lowerName.includes(keyword))) {
    return "high";
  }

  if (mediumDemand.some(keyword => lowerName.includes(keyword))) {
    return "medium";
  }

  return "low";
}
```

#### 4. Colored Curb Rules Seeder (`curb-rules-seeder.ts`)

```typescript
import { db } from "../../../db";
import { coloredCurbRules } from "../../../../shared/schema-parking-rules";

const SF_CURB_RULES = [
  {
    colorCurb: "white" as const,
    description: "Passenger loading and unloading only",
    timeLimitMinutes: 5,
    allowedUses: ["passenger_loading"],
    enforced24_7: true,
    exceptions: "May stop longer if actively loading/unloading passengers with disabilities",
    sourceUrl: "https://www.sfmta.com/getting-around/drive-park/parking-tips/how-read-parking-signs",
  },
  {
    colorCurb: "yellow" as const,
    description: "Commercial loading and unloading only",
    timeLimitMinutes: 30,
    allowedUses: ["commercial_loading"],
    enforced24_7: false,
    exceptions: "Time limits posted on signs. After hours may be available for general parking (check signs)",
    sourceUrl: "https://www.sfmta.com/getting-around/drive-park/parking-tips/how-read-parking-signs",
  },
  {
    colorCurb: "green" as const,
    description: "Short-term parking",
    timeLimitMinutes: 10,
    allowedUses: ["general_parking"],
    enforced24_7: false,
    exceptions: "Time limit shown on sign (typically 10-30 minutes). Hours shown on sign",
    sourceUrl: "https://www.sfmta.com/getting-around/drive-park/parking-tips/how-read-parking-signs",
  },
  {
    colorCurb: "blue" as const,
    description: "Disabled parking only (placard or license plate required)",
    timeLimitMinutes: null, // No time limit
    allowedUses: ["disabled_parking"],
    enforced24_7: true,
    exceptions: "Must display valid disabled placard or license plate",
    sourceUrl: "https://www.sfmta.com/getting-around/drive-park/parking-tips/how-read-parking-signs",
  },
  {
    colorCurb: "red" as const,
    description: "No stopping, standing, or parking at any time",
    timeLimitMinutes: null, // No parking allowed
    allowedUses: [],
    enforced24_7: true,
    exceptions: "Emergency vehicles only",
    sourceUrl: "https://www.sfmta.com/getting-around/drive-park/parking-tips/how-read-parking-signs",
  },
];

export async function seedCurbRules(): Promise<void> {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  SEEDING: Colored Curb Rules (SF-wide)");
  console.log("═══════════════════════════════════════════════\n");

  try {
    console.log(`Inserting ${SF_CURB_RULES.length} curb rules...`);

    for (const rule of SF_CURB_RULES) {
      await db.insert(coloredCurbRules).values({
        ...rule,
        lastVerified: new Date(),
      });
    }

    console.log("\n✅ Curb rules seeded successfully!\n");

  } catch (error: any) {
    console.error("\n❌ Curb rules seeding failed:", error.message);
    throw error;
  }
}
```

---

## API Endpoints

### Main Endpoint: Get Parking Rules at Location

**File:** `/server/routes-parking-rules.ts`

```typescript
import { Router } from "express";
import { getParkingRulesAtLocation } from "./services/parking-rules-engine";
import { z } from "zod";

export const parkingRulesRouter = Router();

/**
 * POST /api/parking/rules
 * Get consolidated parking rules for a specific location and time
 */
parkingRulesRouter.post("/rules", async (req, res) => {
  try {
    const schema = z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      datetime: z.string().datetime().optional(), // ISO 8601 format
    });

    const { latitude, longitude, datetime } = schema.parse(req.body);

    const queryTime = datetime ? new Date(datetime) : new Date();

    const rules = await getParkingRulesAtLocation({
      latitude,
      longitude,
      datetime: queryTime,
    });

    res.json(rules);

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request",
        details: error.errors,
      });
    }

    console.error("Error getting parking rules:", error);
    res.status(500).json({ error: "Failed to get parking rules" });
  }
});

/**
 * GET /api/parking/meters/nearby
 * Find parking meters near a location
 */
parkingRulesRouter.get("/meters/nearby", async (req, res) => {
  try {
    const schema = z.object({
      latitude: z.string().transform(Number),
      longitude: z.string().transform(Number),
      radius: z.string().transform(Number).default("200"), // meters
    });

    const { latitude, longitude, radius } = schema.parse(req.query);

    // TODO: Implement spatial query
    // This would use PostGIS or a simple bounding box query

    res.json({ message: "Not implemented yet" });

  } catch (error: any) {
    res.status(400).json({ error: "Invalid parameters" });
  }
});

/**
 * GET /api/parking/events/upcoming
 * Get upcoming events that affect parking
 */
parkingRulesRouter.get("/events/upcoming", async (req, res) => {
  try {
    const schema = z.object({
      latitude: z.string().transform(Number).optional(),
      longitude: z.string().transform(Number).optional(),
      radius: z.string().transform(Number).default("1000"), // meters
      days: z.string().transform(Number).default("7"), // next 7 days
    });

    const params = schema.parse(req.query);

    // TODO: Query events table for upcoming events

    res.json({ message: "Not implemented yet" });

  } catch (error: any) {
    res.status(400).json({ error: "Invalid parameters" });
  }
});
```

---

## Rule Engine Logic

**File:** `/server/services/parking-rules-engine.ts`

```typescript
import { db } from "../db";
import {
  parkingRegulations,
  parkingMeters,
  coloredCurbRules,
  events,
  meterRates,
} from "../../shared/schema-parking-rules";
import { sql } from "drizzle-orm";

export interface ParkingRulesQuery {
  latitude: number;
  longitude: number;
  datetime: Date;
}

export interface ParkingRulesResponse {
  location: {
    latitude: number;
    longitude: number;
  };
  queryTime: string;
  rules: {
    // Primary rule (most restrictive)
    primary: {
      type: "metered" | "time_limited" | "permit_required" | "colored_curb" | "no_parking" | "unrestricted";
      description: string;
      timeLimit?: number; // minutes
      cost?: {
        hourlyRate: number;
        maxDailyRate?: number;
      };
      restrictions?: string[];
    };

    // Secondary considerations
    considerations: {
      streetCleaning?: {
        description: string;
        nextOccurrence?: string;
      };
      permitZone?: {
        area: string;
        required: boolean;
      };
      coloredCurb?: {
        color: string;
        description: string;
      };
      nearbyEvent?: {
        eventName: string;
        venue: string;
        startTime: string;
        demandLevel: "high" | "medium" | "low";
        distanceMeters: number;
      };
    };

    // Alternative options
    alternatives: {
      nearbyMeters: number;
      nearbyGarages: Array<{
        name: string;
        distanceMeters: number;
        availableSpaces?: number;
      }>;
    };
  };

  // User-friendly summary
  summary: {
    canParkNow: boolean;
    recommendation: string;
    warnings: string[];
  };
}

/**
 * Main Rule Engine
 * Combines all data sources to determine parking rules at a location
 */
export async function getParkingRulesAtLocation(
  query: ParkingRulesQuery
): Promise<ParkingRulesResponse> {
  const { latitude, longitude, datetime } = query;

  // Step 1: Find nearest street segment (regulation)
  const nearestRegulation = await findNearestRegulation(latitude, longitude);

  // Step 2: Check for parking meter at this exact location
  const nearbyMeter = await findNearbyMeter(latitude, longitude, 10); // 10m radius

  // Step 3: Check colored curb rules
  const curbRule = nearestRegulation?.colorCurb
    ? await getCurbRule(nearestRegulation.colorCurb)
    : null;

  // Step 4: Check for nearby events
  const nearbyEvent = await findNearbyEvent(latitude, longitude, datetime, 500); // 500m radius

  // Step 5: Get meter pricing if applicable
  const meterPricing = nearbyMeter
    ? await getMeterPricing(nearbyMeter.rateArea, datetime)
    : null;

  // Step 6: Apply rule priority and build response
  return buildRulesResponse({
    location: { latitude, longitude },
    queryTime: datetime,
    regulation: nearestRegulation,
    meter: nearbyMeter,
    curbRule,
    event: nearbyEvent,
    pricing: meterPricing,
  });
}

/**
 * Find nearest parking regulation using simple distance calculation
 * In production, use PostGIS ST_Distance for accurate geospatial queries
 */
async function findNearestRegulation(lat: number, lon: number) {
  // Simplified: In production, use PostGIS or similar
  // For now, we'll do a bounding box query

  const latDelta = 0.001; // ~100 meters
  const lonDelta = 0.001;

  const nearby = await db
    .select()
    .from(parkingRegulations)
    .where(sql`
      ${parkingRegulations.geometry}::jsonb->'coordinates' IS NOT NULL
    `)
    .limit(1);

  // TODO: Implement proper spatial query
  return nearby[0] || null;
}

async function findNearbyMeter(lat: number, lon: number, radiusMeters: number) {
  // Simple distance calculation (Haversine)
  const meters = await db
    .select()
    .from(parkingMeters)
    .where(sql`
      ${parkingMeters.latitude} BETWEEN ${lat - 0.0001} AND ${lat + 0.0001}
      AND ${parkingMeters.longitude} BETWEEN ${lon - 0.0001} AND ${lon + 0.0001}
    `)
    .limit(1);

  return meters[0] || null;
}

async function getCurbRule(color: string) {
  const rule = await db
    .select()
    .from(coloredCurbRules)
    .where(sql`${coloredCurbRules.colorCurb} = ${color}`)
    .limit(1);

  return rule[0] || null;
}

async function findNearbyEvent(
  lat: number,
  lon: number,
  queryTime: Date,
  radiusMeters: number
) {
  // Find events happening within 2 hours of query time
  const twoHoursBefore = new Date(queryTime.getTime() - 2 * 60 * 60 * 1000);
  const twoHoursAfter = new Date(queryTime.getTime() + 2 * 60 * 60 * 1000);

  const nearbyEvents = await db
    .select()
    .from(events)
    .where(sql`
      ${events.startTime} BETWEEN ${twoHoursBefore} AND ${twoHoursAfter}
      AND ${events.venueLatitude} BETWEEN ${lat - 0.01} AND ${lat + 0.01}
      AND ${events.venueLongitude} BETWEEN ${lon - 0.01} AND ${lon + 0.01}
    `)
    .limit(1);

  return nearbyEvents[0] || null;
}

async function getMeterPricing(rateArea: string | null, queryTime: Date) {
  if (!rateArea) return null;

  // TODO: Implement time-based rate lookup
  return {
    hourlyRate: 3.50, // Default SF rate
  };
}

/**
 * Build final response with rule priority logic
 */
function buildRulesResponse(data: any): ParkingRulesResponse {
  const { location, queryTime, regulation, meter, curbRule, event, pricing } = data;

  // Rule Priority:
  // 1. Red curb (no parking) - highest priority
  // 2. Metered parking
  // 3. Colored curb rules
  // 4. Time-limited parking
  // 5. Permit parking
  // 6. Street cleaning (temporary)
  // 7. Unrestricted

  let primaryRule: any = {
    type: "unrestricted",
    description: "No posted restrictions",
  };

  let canParkNow = true;
  const warnings: string[] = [];

  // Check red curb first
  if (curbRule?.colorCurb === "red") {
    primaryRule = {
      type: "no_parking",
      description: "No stopping, standing, or parking at any time",
    };
    canParkNow = false;
  }
  // Check for meter
  else if (meter) {
    primaryRule = {
      type: "metered",
      description: `Metered parking (${meter.meterType})`,
      cost: pricing,
    };

    // Check if meters are enforced at this time
    const hour = queryTime.getHours();
    const day = queryTime.getDay();

    // SF meters typically enforced Mon-Sat 8am-6pm
    if (day >= 1 && day <= 6 && hour >= 8 && hour < 18) {
      primaryRule.restrictions = ["Must pay at meter", "Check time limit on meter"];
    } else {
      warnings.push("Meter not enforced at this time - free parking");
    }
  }
  // Check other colored curbs
  else if (curbRule && curbRule.colorCurb !== "none") {
    primaryRule = {
      type: "colored_curb",
      description: curbRule.description,
      timeLimit: curbRule.timeLimitMinutes,
    };

    if (curbRule.colorCurb === "blue" && curbRule.allowedUses.includes("disabled_parking")) {
      primaryRule.restrictions = ["Disabled placard or license plate required"];
    }
  }
  // Check regulation-based rules
  else if (regulation) {
    if (regulation.requiresPermit) {
      primaryRule = {
        type: "permit_required",
        description: `Residential permit parking (${regulation.permitArea})`,
        timeLimit: regulation.timeLimitMinutes,
      };
      warnings.push("Permit required during posted hours");
    } else if (regulation.timeLimitMinutes) {
      primaryRule = {
        type: "time_limited",
        description: `${regulation.parkingCategory} - ${regulation.timeLimitMinutes} minute limit`,
        timeLimit: regulation.timeLimitMinutes,
      };
    }
  }

  // Check for street cleaning
  const streetCleaning = regulation?.streetCleaningDay
    ? {
        description: `Street cleaning: ${regulation.streetCleaningDay} ${regulation.streetCleaningTimeStart}-${regulation.streetCleaningTimeEnd}`,
      }
    : undefined;

  if (streetCleaning) {
    warnings.push("Street cleaning restrictions apply - check signs");
  }

  // Check for nearby events
  let nearbyEventInfo;
  if (event) {
    nearbyEventInfo = {
      eventName: event.eventName,
      venue: event.venueName,
      startTime: event.startTime.toISOString(),
      demandLevel: event.parkingDemandLevel,
      distanceMeters: 0, // TODO: Calculate actual distance
    };

    warnings.push(`${event.venueName} event starting soon - expect high demand`);
  }

  // Generate recommendation
  let recommendation = "";
  if (!canParkNow) {
    recommendation = "No parking allowed at this location";
  } else if (meter && pricing) {
    recommendation = `Metered parking available - $${pricing.hourlyRate}/hour`;
  } else if (regulation?.requiresPermit) {
    recommendation = "Permit required during posted hours - visitors may park outside permit hours";
  } else if (regulation?.timeLimitMinutes) {
    recommendation = `${regulation.timeLimitMinutes}-minute parking available`;
  } else {
    recommendation = "Unrestricted parking - check signs for any temporary restrictions";
  }

  return {
    location,
    queryTime: queryTime.toISOString(),
    rules: {
      primary: primaryRule,
      considerations: {
        streetCleaning,
        permitZone: regulation?.permitArea ? {
          area: regulation.permitArea,
          required: regulation.requiresPermit,
        } : undefined,
        coloredCurb: curbRule ? {
          color: curbRule.colorCurb,
          description: curbRule.description,
        } : undefined,
        nearbyEvent: nearbyEventInfo,
      },
      alternatives: {
        nearbyMeters: 0, // TODO: Count nearby meters
        nearbyGarages: [], // TODO: Query garages
      },
    },
    summary: {
      canParkNow,
      recommendation,
      warnings,
    },
  };
}
```

---

## Implementation Steps

### Phase 1: Setup (Day 1)

1. **Create database schema:**
   ```bash
   # Create new Drizzle config for parking rules schema
   npx drizzle-kit generate --config=drizzle-parking-rules.config.ts
   npx drizzle-kit push --config=drizzle-parking-rules.config.ts
   ```

2. **Install dependencies:**
   ```bash
   npm install node-ical  # For iCal parsing
   ```

### Phase 2: Data Seeding (Day 2-3)

3. **Run seeders in order:**
   ```bash
   # Colored curb rules (fast - hard-coded)
   npm run seed:curb-rules

   # Parking regulations (slow - ~50K records)
   npm run seed:regulations

   # Parking meters (medium - ~28K records)
   npm run seed:meters

   # Off-street parking (fast - ~20 records)
   npm run seed:garages

   # Events (fast - ~100 records)
   npm run seed:events
   ```

### Phase 3: API Development (Day 4-5)

4. **Implement rule engine:**
   - Create `/server/services/parking-rules-engine.ts`
   - Add spatial query logic
   - Test with various coordinates

5. **Add API endpoints:**
   - Add routes to `/server/routes.ts`
   - Test with Postman/curl

### Phase 4: Frontend Integration (Day 6-7)

6. **Update React frontend:**
   - Add "Check parking rules" button on map
   - Display rules in a card/modal
   - Show warnings and recommendations

### Phase 5: Optimization (Ongoing)

7. **Add PostGIS extension** for accurate spatial queries
8. **Create materialized views** for faster lookups
9. **Add caching layer** (Redis) for frequently queried locations
10. **Schedule daily event sync** via cron job

---

## Testing

### Test Locations:

```javascript
// Downtown SF - Metered parking
{
  latitude: 37.7946,
  longitude: -122.3999,
  expected: "Metered parking"
}

// Near Chase Center - Event impact
{
  latitude: 37.7679,
  longitude: -122.3874,
  expected: "High demand during events"
}

// Residential area - Permit parking
{
  latitude: 37.7599,
  longitude: -122.4148,
  expected: "Residential permit required"
}
```

### Test API:

```bash
curl -X POST http://localhost:5000/api/parking/rules \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 37.7946,
    "longitude": -122.3999,
    "datetime": "2025-10-26T14:00:00Z"
  }'
```

---

## Next Steps

After implementing the base layer:

1. **Add user-generated data layer:**
   - Real-time availability updates
   - User reports of enforcement
   - Photo verification

2. **Enhance rule engine:**
   - Machine learning for demand prediction
   - Historical availability patterns
   - Route optimization for parking search

3. **Mobile app:**
   - Push notifications for street cleaning
   - Save favorite parking spots
   - Navigate to recommended parking

---

**Questions?** See the individual implementation files for complete code examples!
