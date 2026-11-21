/**
 * Authenticate a request claiming to be a Google crawler using forward-confirmed
 * reverse DNS (FCrDNS), as documented at:
 * https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests
 *
 * Uses DNS-over-HTTPS rather than node:dns so it also works in Cloudflare Workers.
 * CF-Connecting-IP must be taken ONLY from a trusted Cloudflare ingress.
 */
export type GoogleDnsVerification = 'verified' | 'unverified' | 'error';
type RecordType = 'PTR' | 'A' | 'AAAA';
export type DnsLookup = (name: string, type: RecordType) => Promise<string[]>;

const GOOGLE_UA =
	/(?:googlebot|googleother|google-inspectiontool|adsbot-google|mediapartners-google|storebot-google|google-read-aloud|googleweblight|google-safety|google-site-verification)/i;

export function claimsGoogleCrawler(userAgent: string | null): boolean {
	return GOOGLE_UA.test(userAgent ?? '');
}

function parseIpv4(value: string): number[] | null {
	if (!/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(value)) return null;
	const parts = value.split('.').map(Number);
	if (parts.some((part) => part > 255)) return null;
	return parts;
}

export function parseIpAddress(value: string): number[] | null {
	// Invalid headers (including comma-separated chains) must not be accepted.
	if (!value || value !== value.trim()) return null;
	const ipv4 = parseIpv4(value);
	if (ipv4) return ipv4;
	if (!value.includes(':') || value.includes('%')) return null;

	let normalized: string;
	try {
		// WHATWG URL canonicalization expands IPv4-embedded IPv6 forms into hex.
		const hostname = new URL('http://[' + value + ']/').hostname;
		if (!hostname.startsWith('[') || !hostname.endsWith(']')) return null;
		normalized = hostname.slice(1, -1);
	} catch {
		return null;
	}
	if (!/^[0-9a-f:]+$/.test(normalized)) return null;
	const halves = normalized.split('::');
	if (halves.length > 2) return null;
	const left = halves[0] ? halves[0].split(':') : [];
	const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
	if ([...left, ...right].some((piece) => !/^[0-9a-f]{1,4}$/.test(piece))) {
		return null;
	}
	const missing = 8 - left.length - right.length;
	if ((halves.length === 2 && missing < 1) ||
		(halves.length === 1 && missing !== 0)) return null;
	const words = [...left, ...Array(missing).fill('0'), ...right].map((part) => parseInt(part, 16));
	if (words.length !== 8) return null;
	return words.flatMap((word) => [word >>> 8, word & 255]);
}

export function reverseDnsName(ip: string): string | null {
	const bytes = parseIpAddress(ip);
	if (!bytes) return null;
	if (bytes.length === 4) return [...bytes].reverse().join('.') + '.in-addr.arpa';
	return bytes.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('').split('').reverse().join('.') + '.ip6.arpa';
}

export function isGoogleHostname(value: string): boolean {
	const name = value.toLowerCase().replace(/\.$/, '');
	if (!/^[a-z0-9.-]+$/.test(name) || name.includes('..')) return false;
	// A precise suffix comparison rejects evilgooglebot.com and
	// googlebot.com.attacker.example; Google documents these three domains.
	return ['googlebot.com', 'google.com', 'googleusercontent.com']
		.some((suffix) => name === suffix || name.endsWith('.' + suffix));
}

export async function lookupDnsOverHttps(name: string, type: RecordType): Promise<string[]> {
	const url = new URL('https://cloudflare-dns.com/dns-query');
	url.searchParams.set('name', name);
	url.searchParams.set('type', type);
	const response = await fetch(url.toString(), {
		headers: { Accept: 'application/dns-json' },
		signal: AbortSignal.timeout(1250)
	});
	if (!response.ok) throw new Error('DNS-over-HTTPS unavailable');
	const data = await response.json() as {
		Status?: number;
		Answer?: Array<{ type?: number; data?: string }>;
	};
	if (data.Status === 3) return []; // NXDOMAIN is a definitive negative result.
	if (data.Status !== 0) throw new Error('DNS lookup failed');
	const code = { PTR: 12, A: 1, AAAA: 28 }[type];
	return (data.Answer ?? []).filter((entry) => entry.type === code &&
		typeof entry.data === 'string').map((entry) => entry.data as string);
}

export async function verifyGoogleCrawlerIp(
	ip: string,
	lookup: DnsLookup = lookupDnsOverHttps
): Promise<GoogleDnsVerification> {
	const expected = parseIpAddress(ip);
	const reverse = reverseDnsName(ip);
	if (!expected || !reverse) return 'unverified';
	let ptrNames: string[];
	try {
		ptrNames = (await lookup(reverse, 'PTR'))
			.map((name) => name.replace(/\.$/, '').toLowerCase())
			.filter(isGoogleHostname).slice(0, 4);
	} catch {
		return 'error';
	}
	if (!ptrNames.length) return 'unverified';

	let successfulForwardQuery = false;
	for (const hostname of ptrNames) {
		const results = await Promise.allSettled([
			lookup(hostname, 'A'),
			lookup(hostname, 'AAAA')
		]);
		for (const result of results) {
			if (result.status !== 'fulfilled') continue;
			successfulForwardQuery = true;
			if (result.value.some((address) => {
				const actual = parseIpAddress(address);
				return actual !== null && actual.length === expected.length &&
					actual.every((byte, index) => byte === expected[index]);
			})) return 'verified';
		}
	}
	return successfulForwardQuery ? 'unverified' : 'error';
}

// Per-isolate cache and in-flight dedup: repeated spoofed UAs must not produce
// repeated outbound DNS requests for the same IP. Network errors expire quickly.
const cache = new Map<string, { result: GoogleDnsVerification; expires: number }>();
const inFlight = new Map<string, Promise<GoogleDnsVerification>>();
const MAX_CACHE_ENTRIES = 2048;

export async function verifyGoogleCrawlerIpCached(ip: string): Promise<GoogleDnsVerification> {
	if (!parseIpAddress(ip)) return 'unverified';
	const cached = cache.get(ip);
	if (cached && cached.expires > Date.now()) return cached.result;
	const existing = inFlight.get(ip);
	if (existing) return existing;
	const pending = verifyGoogleCrawlerIp(ip)
		.then((result) => {
			const ttl = result === 'verified' ? 10 * 60_000 :
				result === 'unverified' ? 5 * 60_000 : 20_000;
			cache.delete(ip);
			cache.set(ip, { result, expires: Date.now() + ttl });
			if (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
			return result;
		})
		.finally(() => inFlight.delete(ip));
	inFlight.set(ip, pending);
	return pending;
}
