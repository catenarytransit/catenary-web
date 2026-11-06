import type { PageServerLoad } from './$types';
import { lookupIp, visitorIp } from '$lib/server/geoip/index.mjs';

export const prerender = false;

export const load: PageServerLoad = async ({ request, setHeaders }) => {
	// Applies to both HTML and SvelteKit data responses. Assets keep their normal caching.
	setHeaders({ 'cache-control': 'private, no-store' });
	return { initialCamera: await lookupIp(visitorIp(request.headers)) };
};
