# Parking Slot Sharing App - Design Guidelines

## Design Approach

**Selected Approach**: Design System + Reference-Based Hybrid
- **Primary System**: Material Design 3 for mobile-optimized components and interaction patterns
- **Reference Inspiration**: Google Maps (map interface), Waze (real-time status indicators), Citymapper (list/map toggle pattern)
- **Rationale**: Utility-focused mobile app requiring efficient, familiar patterns for location-based services with real-time updates

## Core Design Principles

1. **Mobile-First Priority**: Optimized for thumb-friendly interactions and one-handed use
2. **Information Clarity**: Instant visual feedback on parking availability status
3. **Speed of Action**: Minimize steps between opening app and finding/marking parking
4. **Spatial Awareness**: Map as primary interface with supporting list view

## Typography

**Font Family**: 
- Primary: 'Inter' (Google Fonts) - exceptional readability at small sizes
- Fallback: -apple-system, BlinkMacSystemFont, system-ui

**Type Scale**:
- **Hero/Page Titles**: text-2xl (24px), font-bold
- **Section Headers**: text-lg (18px), font-semibold
- **Card Titles/Locations**: text-base (16px), font-medium
- **Body Text**: text-sm (14px), font-normal
- **Metadata/Timestamps**: text-xs (12px), font-normal, reduced opacity

## Layout System

**Spacing Primitives**: Tailwind units of 2, 4, 6, and 8
- **Micro spacing** (gaps, padding): p-2, gap-2
- **Component padding**: p-4, px-4, py-3
- **Section spacing**: space-y-6, mb-6
- **Screen margins**: p-4 mobile, p-6 desktop

**Grid Structure**:
- Single column mobile (base)
- Map view: Full viewport height minus header/controls
- List view: Single scrollable column
- Desktop: 60/40 split (map/sidebar) at lg: breakpoint

## Component Library

### Navigation & Header
- **Top App Bar**: Fixed position, h-14, shadow-sm
- Contains: App logo/title (left), action icons (right)
- Search bar integrated below header when needed
- Material Design elevation level 1

### Map Interface (Primary View)
- **Full-screen map** with overlay controls
- **Parking Markers**: 
  - Available: Green pin with "P" icon, larger size
  - Just Posted: Green with animated pulse effect
  - Occupied/Claimed: Grey pin, smaller size, 50% opacity
- **User Location**: Blue dot with subtle glow
- **Map Controls**: 
  - Zoom buttons (bottom-right corner)
  - Center on user location button (bottom-right, above zoom)
  - Map/List toggle (top-right, below header)

### Floating Action Button (FAB)
- **Primary FAB**: bottom-right, mb-20, mr-4
- Round, size w-14 h-14
- Icon: Plus or parking icon
- Action: "Mark Spot Available"
- Material Design elevation level 6
- No background blur needed (solid button)

### Parking Slot Cards
**Map Info Window** (appears on marker click):
- Compact card, max-w-sm
- Address (font-semibold)
- Distance from user
- Time posted (e.g., "2 mins ago")
- Action button: "Navigate Here" or "Mark as Taken"
- Close button (top-right corner)

**List View Cards**:
- Full-width cards with p-4
- Left section: Location pin icon
- Main content: Address, distance, time
- Right section: Chevron or action button
- Divider between cards (border-b)
- Tap to expand or navigate

### Bottom Sheet / Modal
**Add Parking Spot Form**:
- Slides up from bottom (mobile) or modal (desktop)
- Title: "Share Your Parking Spot"
- Auto-detected location with map preview
- Confirm location button
- Optional: Add notes field
- Submit button: "Mark Available"
- Cancel action (top-left)

**Confirmation Dialog**:
- Centered modal with rounded corners
- Icon (checkmark for success)
- Message text
- Single action button
- Auto-dismiss after 2 seconds

### List View Toggle
**Alternative View Layout**:
- Header with filters: "Nearby" | "Recent" | "All"
- Scrollable list of parking cards
- Pull-to-refresh gesture
- Empty state: "No available parking nearby" with illustration placeholder

### Status Indicators
- **Real-time Badge**: Small pill badge "LIVE" or "2m ago" on cards
- **Distance Indicator**: Icon + text, e.g., "0.3 mi away"
- **Availability Count**: Top of list view, e.g., "5 spots available nearby"

### Empty States
- Center-aligned content
- Icon placeholder (parking-related)
- Primary message: text-lg, font-semibold
- Secondary message: text-sm, muted
- Call-to-action button

## Images

No hero images required - this is a utility app. However:

**Map Integration**:
- Use Mapbox GL JS or Google Maps JavaScript API
- Style map with minimal, clean aesthetics
- De-emphasize irrelevant map details
- Emphasize roads and parking-relevant landmarks

**Icons Throughout**:
- Use Material Icons (CDN) for consistency
- Key icons: location_on, local_parking, navigation, add_location, my_location, list, map
- All icons should be 20px or 24px for consistency

**Illustration Placeholders**:
- Empty state: "<!-- ILLUSTRATION: Empty parking lot with car -->"
- No results: "<!-- ILLUSTRATION: Magnifying glass searching -->"

## Responsive Breakpoints

**Mobile (default)**: 
- Full-screen map
- FAB bottom-right
- Bottom sheet for forms
- Single-column list view

**Tablet (md: 768px)**:
- Larger cards in list view (2 columns if space)
- More detailed info windows
- Larger touch targets

**Desktop (lg: 1024px)**:
- Split view: Map (60%) | Sidebar (40%)
- Sidebar contains: filters, list view, active spot details
- Traditional modal dialogs instead of bottom sheets
- Hover states on interactive elements

## Interaction Patterns

**Map Interactions**:
- Tap marker → Show info window
- Drag map → Browse area
- Pinch/zoom → Adjust map view
- Tap "My Location" → Re-center on user

**Quick Actions**:
- Swipe on list card → Quick "Navigate" action
- Long-press on map → "Mark this location as available"

**Status Updates**:
- Subtle toast notifications for confirmations
- Real-time marker updates without page refresh
- Loading states for location detection

## Accessibility
- All interactive elements minimum 44x44px touch target
- High contrast between markers and map
- Clear focus states for keyboard navigation
- Screen reader labels for all icons and actions
- Color not sole indicator (use icons + text)

## Performance Considerations
- Lazy load map tiles
- Cluster markers when zoomed out (show count badges)
- Cache recent searches and locations
- Optimistic UI updates (instant feedback, sync in background)