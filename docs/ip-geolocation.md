# Initial map location

The first SvelteKit page response includes an approximate initial map center.
There is no client fetch to Birch and the first MapLibre render uses these
coordinates. An existing map URL hash or saved GPS position takes precedence.

## Production: Node behind Cloudflare Tunnel

The production Docker image uses the SvelteKit Node adapter, started through
`bun build/index.js`. The adapter is configured with
`ADDRESS_HEADER=CF-Connecting-IP` to make
`event.getClientAddress()` return the Cloudflare-forwarded visitor address.

**Security boundary:** Only deploy with this setting when all inbound traffic
is forced through a trusted Cloudflare Tunnel or equivalent controlled proxy.
A directly reachable origin must not trust arbitrary client-supplied
`CF-Connecting-IP` headers. If serving directly, unset `ADDRESS_HEADER`
and use the socket address. Do not trust the leftmost `X-Forwarded-For` entry.

The handler also supports Cloudflare Workers using `platform.cf.latitude`
and `platform.cf.longitude`; its Worker build aliases the Node-only
index reader to a no-op implementation.

## Refreshing the database

`bun run build` executes `scripts/update-geoip.sh` before compiling the
application. It downloads the IPv4 and IPv6 **numeric city** DB-IP Lite
datasets from sapics/ip-location-db, verifies each SHA-256 checksum from
the repository's checksum release, and converts them to fixed-width,
sorted binary indexes. The final Node image contains only the indexes,
not the downloaded CSV. The CI image build passes a per-run build argument,
ensuring the refresh step is never masked by a cached Docker layer.

The source is DB-IP Lite City, CC BY 4.0, available at
https://github.com/sapics/ip-location-db. A visible link to
https://db-ip.com/ appears in MapLibre's attribution control.

Index format: 8 ASCII bytes `CTGEOIP1`, a little-endian u32 record count,
then records. IPv4 records are big-endian u32 start/end, little-endian
f32 longitude/latitude (16 bytes). IPv6 records are big-endian u128
start/end, little-endian f32 longitude/latitude (40 bytes).

Both indexes are loaded and validated once at Node server startup.
Requests perform an in-memory binary search, not I/O. The database may
consume significant resident memory; size the container accordingly.
For a custom volume set `GEOIP_DATA_DIR` to the directory containing the
two `.bin` files.

## Fallback behavior

Priority is: URL map hash > saved GPS > IP geolocation > world view.
IP coordinates are approximate and deliberately start at a regional zoom.

Responses carrying an IP-derived center use `Cache-Control: private, no-store`.
Do not enable full-page caching at Cloudflare for the home page. Map tiles can
still use their ordinary caching policies.

## Performance verification

Benchmark warm `ipToCenter()` calls separately from process startup, for
both IPv4 and IPv6, with production-sized indexes. Track p50/p99 lookup
latency, first-request TTFB and per-process RSS. The intended target is
low-single-digit milliseconds of additional work; no benchmark claim is
made without measured production data.
