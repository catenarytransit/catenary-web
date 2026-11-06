# Initial map location

The Node deployment behind Cloudflare Tunnel reads `CF-Connecting-IP` on the first
page request and searches a local binary GeoLite2 city database. When Cloudflare
Pseudo IPv4 overwrites that header, `CF-Connecting-IPv6` takes precedence. No
Cloudflare coordinate headers or Birch request are needed. The origin must remain
reachable only through the trusted tunnel; this code deliberately does not trust
arbitrary `X-Forwarded-For` chains.

## Build and deployment

Run `npm run build` as usual. It downloads both GeoLite2 city CSV.gz families from
the current `sapics/ip-location-db` GitHub release (the npm feed stopped updating
in June 2026), verifies their release SHA-256 digests, compiles them into `.geoip`, runs Vite,
then copies the database and upstream license/EULA into `build/geoip`. Deploy the
whole `build` directory and run `node build` from the project directory. No
database daemon, API key, native addon, or schema migration is required. The
existing Vite preview command also works from the project directory.

`npm run geoip:build` prepares data for local development; `npm run geoip:refresh`
forces a download. Builds reuse a checksum-validated cache for at most seven days.
Download/validation failures fail the build and leave the previous cache intact.
Rebuild and redeploy regularly to keep the data current; the runtime performs no
background downloads. Do not commit the generated database to git.

The server checks `build/geoip`, then `.geoip` for development. An optional
`GEOIP_DATABASE_DIR` overrides these paths. Both buffers are loaded once per Node
process with a shared initialization promise. A missing/corrupt database logs once
and gives an overview instead of breaking the page. Deploy a new process to pick
up new database files. This filesystem implementation targets `adapter-node`;
the legacy `cloudflarebuild` Workers deployment is not supported by this feature.

## Data format and camera behavior

The 16-byte header contains `CTGEO001`, address family, and record count. Records
hold start/end addresses in network byte order plus float32 latitude, longitude,
and zoom. IPv4 records are 20 bytes and IPv6 records 44 bytes. The compiler streams
CSV, validates ordered disjoint inclusive ranges, and writes bounded batches.
IPv6 never passes through a JavaScript Number. Lookup finds the preceding start
by binary search and checks its end to exclude gaps.

MapLibre's `#map` URL camera takes precedence, followed by a valid saved browser
location, then the server result. Old `cacheipgeolocation` values are ignored.
The initial camera is supplied before MapLibre is constructed; no later IP lookup
recenters an existing map. City entries start at zoom 10, regional entries at 6,
and country-level coordinates at 4. These are display heuristics, not accuracy
guarantees. Missing IPs, ranges, or coordinates use `[0, 20]` at zoom 2. IP estimates
never populate the GPS/current-location store.

Only coordinates and zoom are serialized in page data, never the visitor IP or
database. Keep HTML and SvelteKit data responses out of Cloudflare's shared cache:
the loader sets `Cache-Control: private, no-store`. Do not override this with a
Cache Everything rule. Static assets retain normal caching. The existing service
worker has no navigation fallback or runtime document cache.

## Attribution and verification

This product includes GeoLite2 data created by MaxMind, available from
<https://www.maxmind.com/>. Map attribution includes this notice. Upstream data:
<https://github.com/sapics/ip-location-db/tree/main/geolite2-city>. The generated
manifest records download date, source update dates and URLs, record counts,
sizes, and source/binary SHA-256 checksums. Upstream license and EULA accompany the packaged data.

Run `npm run test:geoip` on Node 22.18+ (native TypeScript stripping is used by the
camera tests), then `npm run check` and `npm run build`. In a local Node deployment,
request `/` with a `CF-Connecting-IP` header and verify `initialCamera` and the
private cache header; a request without that header should have a null estimate.
