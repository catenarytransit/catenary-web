import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { addressBytes, lookupAddress, validateDatabase } from './binary.mjs';

/** A single shared promise deduplicates simultaneous first requests. No visitor state is retained. */
export function createGeoipLookup(directories, warn = console.warn) {
	let database;
	async function load() {
		for (const directory of directories) {
			try {
				const [v4, v6] = await Promise.all(
					[4, 6].map(async (family) =>
						validateDatabase(await readFile(join(directory, `ipv${family}.bin`)), family)
					)
				);
				return { v4, v6 };
			} catch {
				/* Try the development build cache next. */
			}
		}
		warn('GeoIP database unavailable; run npm run geoip:build. Using world overview.');
		return null;
	}
	return async (ip) => {
		const address = typeof ip === 'string' ? addressBytes(ip, true) : null;
		if (!address) return null;
		database ??= load();
		const data = await database;
		return data ? lookupAddress(address.length === 4 ? data.v4 : data.v6, address) : null;
	};
}

const directories = process.env.GEOIP_DATABASE_DIR
	? [resolve(process.env.GEOIP_DATABASE_DIR)]
	: [resolve('build/geoip'), resolve('.geoip')];
export const lookupIp = createGeoipLookup(directories);

export function visitorIp(headers) {
	// The origin is served through Cloudflare Tunnel. Never use arbitrary X-Forwarded-For chains.
	return headers.get('cf-connecting-ipv6') || headers.get('cf-connecting-ip');
}
