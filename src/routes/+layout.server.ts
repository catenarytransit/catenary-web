import type { LayoutServerLoad } from './$types';
import { shouldExposeHoneypotLinks, type BotSignals } from '$lib/server/honeypot-gate';
import { claimsGoogleCrawler, verifyGoogleCrawlerIpCached } from '$lib/server/google-crawler-dns';

export const prerender = false;

export const load: LayoutServerLoad = async ({ platform, request, setHeaders }) => {
	// Header is trustworthy only when the origin is reachable exclusively via Cloudflare.
	// Strip client-supplied CF-Connecting-IP at any other trusted ingress.
	const signals = (platform as { cf?: BotSignals } | undefined)?.cf;
	const userAgent = request.headers.get('user-agent');
	let googleDnsVerification: 'verified' | 'unverified' | 'error' | undefined;

	if (claimsGoogleCrawler(userAgent)) {
		// Missing/invalid IP or absent edge metadata => do not expose decoy links.
		const clientIp = signals ? request.headers.get('CF-Connecting-IP') : null;
		googleDnsVerification = clientIp
			? await verifyGoogleCrawlerIpCached(clientIp)
			: 'error';
	}

	const exposeHoneypotLinks = shouldExposeHoneypotLinks(
		signals,
		userAgent,
		googleDnsVerification
	);

	if (exposeHoneypotLinks) {
		setHeaders({ 'Cache-Control': 'private, no-store' });
	}

	return { exposeHoneypotLinks };
};
