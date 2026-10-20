import type { PageServerLoad } from './$types';
import { ipToCenter, type MapCenter } from '$lib/server/geoip';

export const prerender = false;

function validLocation(latitude: unknown, longitude: unknown): MapCenter | null {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (latitude == null || longitude == null ||
      !Number.isFinite(lat) || !Number.isFinite(lon) ||
      Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return null;
  }
  return [lon, lat];
}

export const load: PageServerLoad = ({ platform, getClientAddress, setHeaders }) => {
  // The HTML embeds visitor-specific coordinates and must not be cached at the edge.
  setHeaders({ 'cache-control': 'private, no-store' });

  const cf = (platform as { cf?: { latitude?: string; longitude?: string } } | undefined)?.cf;
  const fromCloudflare = cf ? validLocation(cf.latitude, cf.longitude) : null;
  if (fromCloudflare) return { initialCenter: fromCloudflare };

  try {
    return { initialCenter: ipToCenter(getClientAddress()) };
  } catch {
    // Development, private networks and missing client IPs use the globe view.
    return { initialCenter: null };
  }
};
