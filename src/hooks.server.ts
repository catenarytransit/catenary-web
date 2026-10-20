import type { Handle } from '@sveltejs/kit';
import { warmGeoip } from '$lib/server/geoip';

// Keep the disk read and index validation outside the request hot path.
if (process.env.NODE_ENV === 'production') {
  warmGeoip();
}

export const handle: Handle = ({ event, resolve }) => resolve(event);
