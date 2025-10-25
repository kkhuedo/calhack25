# ParkShare - Parking Slot Sharing Application

A real-time parking slot sharing application where users can mark their parking spots as available when leaving and find open parking on an interactive map.

## Features

- **Interactive Map**: Browse available parking spots on a Leaflet-powered map with OpenStreetMap
- **Real-time Updates**: WebSocket-based live updates when parking spots are added, updated, or removed
- **Geolocation**: Automatically center the map on your current location
- **Distance Calculation**: See how far parking spots are from your current location
- **Two Views**: Toggle between map view and list view
- **Dark/Light Mode**: Theme switcher for comfortable viewing
- **Mobile Responsive**: Works seamlessly on desktop and mobile devices

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Wouter** - Lightweight routing
- **TanStack Query** - Server state management
- **Shadcn UI** + **Radix UI** - Component library
- **Tailwind CSS** - Styling
- **Leaflet.js** - Interactive maps
- **Framer Motion** - Animations

### Backend
- **Express.js** - Web server
- **WebSocket (ws)** - Real-time communication
- **PostgreSQL** - Database (Neon serverless)
- **Drizzle ORM** - Type-safe database queries
- **Zod** - Schema validation

### Build Tools
- **Vite** - Frontend bundler
- **esbuild** - Backend bundler
- **tsx** - TypeScript execution

## Prerequisites

- **Node.js** 20.x or higher
- **npm** (comes with Node.js)
- **PostgreSQL database** (we recommend [Neon](https://neon.tech) for serverless PostgreSQL)

## Getting Started

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd calhack25
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your database connection string:

```env
DATABASE_URL=postgresql://username:password@your-host.neon.tech/parkshare?sslmode=require
PORT=5000
NODE_ENV=development
```

#### Getting a Database URL

**Option 1: Neon (Recommended for serverless)**
1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string from the dashboard
4. Paste it into your `.env` file

**Option 2: Local PostgreSQL**
1. Install PostgreSQL locally
2. Create a database: `createdb parkshare`
3. Use connection string: `postgresql://localhost:5432/parkshare`

### 4. Set Up the Database

Push the database schema to your PostgreSQL database:

```bash
npm run db:push
```

This will create the `parking_slots` table with the following schema:
- `id` (UUID, primary key)
- `latitude` (double precision)
- `longitude` (double precision)
- `address` (text)
- `notes` (text, optional)
- `status` (varchar, default: "available")
- `posted_at` (timestamp, default: now)

### 5. Run the Development Server

```bash
npm run dev
```

The application will start on `http://localhost:5000`

## Available Scripts

- **`npm run dev`** - Start development server with hot reload
- **`npm run build`** - Build for production (frontend + backend)
- **`npm run start`** - Start production server (run `build` first)
- **`npm run check`** - Type-check TypeScript code
- **`npm run db:push`** - Push database schema changes

## Project Structure

```
calhack25/
├── client/                  # Frontend React app
│   ├── src/
│   │   ├── App.tsx          # Root component with routing
│   │   ├── main.tsx         # React entry point
│   │   ├── index.css        # Global styles
│   │   ├── pages/
│   │   │   └── Home.tsx     # Main application page
│   │   ├── components/      # React components
│   │   │   ├── ParkingMap.tsx
│   │   │   ├── ParkingSlotCard.tsx
│   │   │   ├── AddParkingSpotDialog.tsx
│   │   │   └── ui/          # Shadcn UI components
│   │   ├── hooks/           # Custom React hooks
│   │   └── lib/             # Utilities
│   └── index.html           # HTML template
│
├── server/                  # Backend Express app
│   ├── index.ts             # Express server entry point
│   ├── routes.ts            # API routes + WebSocket server
│   ├── storage.ts           # Database operations
│   ├── db.ts                # Database connection
│   └── vite.ts              # Vite dev server setup
│
├── shared/                  # Shared code
│   └── schema.ts            # Database schema + Zod validation
│
├── .env                     # Environment variables (create this)
├── .env.example             # Environment variables template
├── package.json             # Dependencies and scripts
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript configuration
├── tailwind.config.ts       # Tailwind CSS configuration
└── drizzle.config.ts        # Database migration configuration
```

## API Endpoints

### REST API

- `GET /health` - Health check with database connectivity
- `GET /api/parking-slots` - List all parking slots
- `GET /api/parking-slots/:id` - Get a single parking slot
- `POST /api/parking-slots` - Create a new parking slot
- `PATCH /api/parking-slots/:id` - Update a parking slot
- `DELETE /api/parking-slots/:id` - Delete a parking slot

### WebSocket

- `WS /ws` - Real-time updates for parking slots
  - Connected clients receive updates when slots are created, updated, or deleted

## Development

### Type Checking

```bash
npm run check
```

### Building for Production

```bash
npm run build
```

This will:
1. Build the React frontend with Vite → `dist/public/`
2. Bundle the Express backend with esbuild → `dist/index.js`

### Running Production Build

```bash
npm run start
```

## Database Migrations

The project uses Drizzle Kit for database migrations. The schema is defined in `shared/schema.ts`.

To push schema changes:

```bash
npm run db:push
```

## Deployment

### Environment Variables

Make sure to set these environment variables in your deployment platform:

- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV=production`
- `PORT` - (optional, defaults to 5000)

### Build Command

```bash
npm run build
```

### Start Command

```bash
npm run start
```

### Deployment Platforms

This app can be deployed to:
- **Vercel** (with Neon PostgreSQL)
- **Render** (with managed PostgreSQL)
- **Railway** (with PostgreSQL addon)
- **Fly.io** (with PostgreSQL cluster)
- **Heroku** (with PostgreSQL addon)
- **DigitalOcean App Platform**
- **AWS** (EC2 + RDS)

## Troubleshooting

### Database Connection Issues

If you see "Database connection failed":
1. Check your `DATABASE_URL` in `.env`
2. Verify your database is running
3. Check firewall/network settings
4. For Neon: Ensure your IP is allowlisted (Neon allows all IPs by default)

### WebSocket Connection Issues

If real-time updates aren't working:
1. Check browser console for WebSocket errors
2. Verify port 5000 is accessible
3. Check if your hosting platform supports WebSockets

### Build Errors

If TypeScript errors occur:
```bash
npm run check
```

If dependency issues occur:
```bash
rm -rf node_modules package-lock.json
npm install
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please open an issue on GitHub.
