# ParkShare - Parking Slot Sharing Application

## Overview
ParkShare is a real-time parking slot sharing application that allows users to mark their parking spots as available when leaving and find open parking on an interactive map. Built with React, TypeScript, Express, and Leaflet for mapping.

## Recent Changes
- **2025-10-25**: Complete MVP implementation with UX improvements
  - Created complete data schema for parking slots
  - Built all frontend components with Material Design 3 principles
  - Implemented interactive Leaflet map with custom markers (green for available, gray for taken)
  - Created responsive list view with distance calculation from user location
  - Added dark mode support with theme toggle
  - Designed beautiful empty states and loading states
  - Implemented full backend with RESTful API endpoints
  - Added WebSocket support for real-time updates across all clients
  - Integrated frontend with backend APIs using TanStack Query
  - Fixed WebSocket cleanup to prevent reconnection loops
  - Implemented strict PATCH validation (only notes and status can be updated)
  - Added auto-dismiss confirmation dialogs for success messages
  - **Relocated "Share Your Spot" button to top-center of map for better accessibility**
  - **Added "Take" button to instantly remove spots from map when parking**
  - All TypeScript errors resolved and LSP clean

## Project Architecture

### Frontend (React + TypeScript)
- **Pages**:
  - `Home.tsx` - Main page with map/list view toggle
- **Components**:
  - `ParkingMap.tsx` - Interactive Leaflet map with markers
  - `ParkingSlotCard.tsx` - Card component for list view
  - `AddParkingSpotDialog.tsx` - Modal for sharing parking spots
  - `EmptyState.tsx` - Beautiful empty state component
  - `LoadingSpinner.tsx` - Loading state component
  - `ThemeToggle.tsx` - Dark/light mode toggle

### Backend (Express + TypeScript)
- In-memory storage for parking slots
- RESTful API endpoints for CRUD operations
- WebSocket support for real-time updates
- Zod validation for request data

### Design System
- **Colors**: Green primary (#22C55E) for available spots, muted grays for taken spots
- **Typography**: Inter font family for clean readability
- **Components**: Shadcn UI with custom tokens
- **Mapping**: Leaflet.js for interactive maps
- **Mobile-first**: Optimized for mobile devices with responsive design

## Features Implemented
- ✅ Interactive map with parking spot markers (Leaflet.js)
- ✅ List view with distance calculations from user location
- ✅ Add parking spot with automatic geolocation detection
- ✅ Mark spots as available/taken with optimistic updates
- ✅ Real-time updates via WebSocket (auto-sync across users)
- ✅ Dark mode support with theme toggle
- ✅ Responsive design for mobile and desktop
- ✅ Beautiful loading and empty states
- ✅ Navigate to parking spots via Google Maps
- ✅ Time ago display for when spots were posted
- ✅ Reverse geocoding for human-readable addresses

## API Routes
- `GET /api/parking-slots` - List all parking slots
- `GET /api/parking-slots/:id` - Get single parking slot
- `POST /api/parking-slots` - Create new parking slot
- `PATCH /api/parking-slots/:id` - Update parking slot status
- `DELETE /api/parking-slots/:id` - Delete parking slot
- WebSocket `/ws` - Real-time updates (slot_created, slot_updated, slot_deleted)

## Technology Stack
- **Frontend**: React, TypeScript, TanStack Query, Wouter, Shadcn UI
- **Map**: Leaflet.js with OpenStreetMap tiles
- **Backend**: Express.js, TypeScript
- **Storage**: In-memory (MemStorage)
- **Real-time**: WebSocket (ws package)
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form + Zod validation
