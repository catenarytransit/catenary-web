// Cloudflare Workers already attach approximate visitor coordinates to request.cf.
// The Node binary index is intentionally excluded from the Worker bundle.
export type MapCenter = [longitude: number, latitude: number];
export function warmGeoip(): void {}
export function ipToCenter(_ip: string): MapCenter | null { return null; }
