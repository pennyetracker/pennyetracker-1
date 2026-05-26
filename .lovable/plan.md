## What's happening

There is no `index.html` because TanStack Start renders HTML on the server from `src/routes/__root.tsx`. That's correct, not the cause of slowness.

The real causes of the slow initial load are visible in the codebase + network log:

1. **Duplicate auth/role fetches** — `src/hooks/use-auth.tsx` calls `loadRoles` from BOTH `onAuthStateChange` (which fires `INITIAL_SESSION` immediately) AND `supabase.auth.getSession().then(...)`. The network log shows 3 identical `/user_roles` requests on a single load. Every page is blocked behind `loading=true` until these finish.
2. **Heavy libraries bundled too eagerly** — `leaflet`, `react-leaflet`, `sql.js` (WASM SQLite for mbtiles), `recharts`, `@xyflow/react` are imported statically by route files. Even visiting `/staff/login` pulls them.
3. **Landing/index does redirect-only work** but waits for auth roles before rendering anything — adds a perceived blank-screen delay.
4. **Router preload** is using defaults — preloads on hover pull large chunks unnecessarily.

## Fix plan

### 1. Auth hook — single fetch, no double load (`src/hooks/use-auth.tsx`)
- Remove the manual `supabase.auth.getSession().then(...)` block; rely solely on `onAuthStateChange`, which fires `INITIAL_SESSION` on mount with the restored session.
- Cache last-fetched `user.id` and skip `loadRoles` if it's the same user (prevents re-fetch on `TOKEN_REFRESHED` events).
- Wrap roles in TanStack Query (`['user_roles', userId]`) so repeated subscribers dedupe automatically.

### 2. Lazy-load map stack
- Convert `src/components/map/LeafletMap.tsx`, `OfflineMap.tsx`, `MapPicker.tsx` consumers to use `React.lazy(() => import(...))` + `<Suspense>` inside route components.
- Routes affected: `map.panchayath.tsx`, `update-location.*`, `marking.*`, `admin.settings.tsx`, `admin.locations.tsx`.
- Keep `leaflet` CSS import only inside those lazy chunks (not at top of route files).

### 3. Lazy-load other heavy libs where used
- `recharts` (admin dashboards) → dynamic import.
- `@xyflow/react` (mapping editor) → already isolated to `admin.mapping.*`; verify it's not pulled by `__root` or `landing`.
- `sql.js` (mbtiles) → only inside the offline-map component, dynamic import + WASM URL.

### 4. Landing page — don't block on roles
- In `src/routes/index.tsx` and `src/routes/landing.tsx`, render the visible shell immediately. Run the role-based redirect inside `useEffect` once `loading=false`, instead of returning a "Checking authentication…" placeholder for the whole page.

### 5. Router + Query tuning (`src/router.tsx`)
- Set `defaultPreloadStaleTime: 0` (Query owns freshness).
- Set `defaultPreload: "intent"` (already default) but add `defaultPendingMinMs: 0` so transitions feel instant.
- In `QueryClient`, set `staleTime: 30_000` and `gcTime: 5 * 60_000` defaults so auth/role data isn't re-fetched on every navigation.

### 6. Drop unused work on cold start
- Verify `__root.tsx` does not import map/chart/xyflow modules transitively (it currently imports only `AuthProvider` + `Toaster`, which is fine — confirm after changes).
- Add `loading="lazy"` and explicit `width`/`height` to images in landing/delivery-partners pages to reduce CLS.

## Technical notes

- The duplicate `user_roles` calls in the network log are the smoking gun for the auth fix. After dedupe, that section should issue exactly **one** request per session.
- Lazy-loading Leaflet alone typically removes ~150 KB gzipped from the initial bundle; lazy-loading `sql.js` removes the WASM blob (~600 KB) from any non-map route.
- No DB schema or business-logic changes. Pure frontend/perf work.

## Out of scope (ask if you want these too)

- Adding a service worker for offline caching.
- Replacing Leaflet with a lighter map.
- Moving role checks to SSR via `createServerFn`.
