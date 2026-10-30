import type { LayoutServerLoad } from './$types';
import { shouldExposeHoneypotLinks, type BotSignals } from '$lib/server/honeypot-gate';

export const prerender = false;

export const load: LayoutServerLoad = ({ platform, request, setHeaders }) => {
	// Cloudflare adapter exposes request.cf via event.platform.cf.
	// Non-Cloudflare runtimes have no trusted bot signals and expose no links.
	const signals = (platform as { cf?: BotSignals } | undefined)?.cf;
	const exposeHoneypotLinks = shouldExposeHoneypotLinks(
		signals,
		request.headers.get('user-agent')
	);

	if (exposeHoneypotLinks) {
		// Never allow a response containing decoy links into a shared cache.
		setHeaders({ 'Cache-Control': 'private, no-store' });
	}

	return { exposeHoneypotLinks };
};
