## Goal

When Google Maps fails to load (invalid key, API not enabled, network blocked, quota exceeded), fall back to a browser-native picker so users can still mark/save locations and view existing ones. Today both `/admin/mapping/panchayath`, `/admin/mapping/ward`, and `/map/panchayath` show only "Oops! Something went wrong" or "Failed to load Google Maps".

## Changes

### 1. New component: `src/components/map/FallbackPicker.tsx`
A no-Google-Maps picker that supports the same save flow as `MapPicker`:
- Header: "Map provider unavailable — using browser GPS fallback" notice.
- **Get my location** button → `navigator.geolocation.getCurrentPosition` (high-accuracy, 10s timeout). On success, sets a draft `{lat, lng}`.
- **Manual entry**: two number inputs for latitude/longitude with validation (-90..90 / -180..180).
- **Marked list** for the selected parent: shows each item with lat/lng (or "—"), an "Open in Google Maps" link (`https://www.google.com/maps?q=lat,lng`) and "Open in OSM" link as a true fallback view.
- **Save / Cancel** buttons reuse the same Supabase update + IndexedDB cache write as `MapPicker`.
- Same left column (parent select, search, item list) as `MapPicker` so the UX is consistent.

### 2. Wire fallback into `src/components/map/MapPicker.tsx`
- When `mapState === "error"` OR `!apiKey`, render `<FallbackPicker .../>` instead of the current error/empty card. Keep a small dismissable banner explaining why ("Google Maps unavailable — using browser GPS").
- Extract the save mutation and parent/list rendering into shared hooks/helpers so both components stay in sync (or pass them down as props — whichever is smaller).

### 3. Public viewer fallback: `src/routes/map.panchayath.tsx`
- When `mapState === "error"` or `apiKey` is missing, render a list view of all marked panchayaths grouped by district, each with:
  - Name + coords
  - "Open in Google Maps" / "Open in OpenStreetMap" deep links
  - "Show on browser map" → opens an OSM static image (`https://staticmap.openstreetmap.de/staticmap.php?...`) for a lightweight visual.
- Keep the existing Google Map render when it works.

### 4. Loader resilience: `src/components/map/useGoogleMaps.ts`
- Add a 10s timeout: if the script tag never fires `load` or `error`, force `state = "error"` so the fallback engages instead of spinning forever.
- Reset the cached `scriptPromise` on error so a later valid key can retry.

## Out of scope
- Routing/turn-by-turn navigation (the current app doesn't use Google Directions; "navigation" here = map view + GPS pin).
- Swapping Google Maps for an OSS map library (Leaflet/MapLibre) — can be a follow-up if you want a real interactive fallback map instead of links + static image.

## Technical notes
- No DB schema changes. Reuses `panchayaths.latitude/longitude`, `wards.latitude/longitude`, `app_settings.google_maps_api_key`, and the existing `get_public_google_maps_key` RPC.
- All browser-GPS code runs only in event handlers (no SSR concerns).
- The "Use my location" button already exists inside `MapPicker`; the fallback path simply makes it usable even when Google Maps never loaded.

## Open question
Do you want a real interactive offline map (Leaflet + OpenStreetMap tiles, ~40KB) as the fallback instead of the link/static-image approach? It's a bigger change but gives proper pan/zoom without any Google dependency. Reply "use leaflet" if yes.
