import { open, mkdir, mkdtemp, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { createGunzip } from 'node:zlib';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { compileGeoip } from './compile-geoip.mjs';
import { validateDatabase } from '../src/lib/server/geoip/binary.mjs';

const target = resolve('.geoip');
const maxAge = 7 * 24 * 60 * 60 * 1000;
const refresh = process.argv.includes('--refresh');
const hash = (data) => createHash('sha256').update(data).digest('hex');
let cached = false;
try {
	const manifest = JSON.parse(await readFile(join(target, 'manifest.json'), 'utf8'));
	if (
		!refresh &&
		manifest.format === 1 &&
		manifest.provider === 'github-releases' &&
		Date.now() - Date.parse(manifest.createdAt) < maxAge
	) {
		for (const family of [4, 6]) {
			const data = validateDatabase(await readFile(join(target, `ipv${family}.bin`)), family);
			if (hash(data) !== manifest.files[`ipv${family}.bin`].sha256)
				throw new Error('GeoIP checksum mismatch');
		}
		for (const notice of ['GEOLITE2_LICENSE', 'GEOLITE2_EULA']) {
			if (!(await readFile(join(target, notice), 'utf8')).trim())
				throw new Error('Missing GeoIP license notice');
		}
		cached = true;
	}
} catch {
	/* Missing or invalid cache is rebuilt. */
}

if (cached) {
	console.info('Using validated GeoIP build cache (less than seven days old).');
} else {
	const staging = await mkdtemp(resolve('.geoip-staging-'));
	try {
		// The npm dataset stopped updating in June 2026. Use the current release feed.
		const metadataResponse = await fetch(
			'https://api.github.com/repos/sapics/ip-location-db/releases/tags/latest',
			{
				headers: { 'user-agent': 'catenary-web-geoip-build' },
				signal: AbortSignal.timeout(60000)
			}
		);
		if (!metadataResponse.ok) throw new Error(`GeoIP metadata HTTP ${metadataResponse.status}`);
		const release = await metadataResponse.json();
		const files = {};
		for (const family of [4, 6]) {
			const asset = release.assets?.find(
				(item) => item.name === `geolite2-city-ipv${family}.csv.gz`
			);
			if (!asset || !/^sha256:[a-f0-9]{64}$/.test(asset.digest))
				throw new Error(`Missing IPv${family} GeoIP asset or SHA-256 digest`);
			const source = asset.browser_download_url;
			console.info(`Compiling IPv${family} GeoIP ranges from ${source}`);
			const response = await fetch(source, { signal: AbortSignal.timeout(300000) });
			if (!response.ok || !response.body) throw new Error(`GeoIP download HTTP ${response.status}`);
			const name = `ipv${family}.bin`;
			const file = await open(join(staging, name), 'w');
			const compressedHash = createHash('sha256');
			const verifier = new Transform({
				transform(chunk, encoding, callback) {
					compressedHash.update(chunk);
					callback(null, chunk);
				}
			});
			let count;
			try {
				await pipeline(
					Readable.fromWeb(response.body),
					verifier,
					createGunzip(),
					async (source) => {
						source.setEncoding('utf8');
						count = await compileGeoip(source, family, file);
					}
				);
			} finally {
				await file.close();
			}
			if (`sha256:${compressedHash.digest('hex')}` !== asset.digest)
				throw new Error(
					`IPv${family} GeoIP source checksum mismatch; retry the build if the upstream release changed`
				);
			const data = validateDatabase(await readFile(join(staging, name)), family);
			files[name] = {
				source,
				sourceUpdatedAt: asset.updated_at,
				sourceSha256: asset.digest,
				count,
				bytes: data.length,
				sha256: hash(data)
			};
			console.info(`IPv${family}: ${count} records, ${(data.length / 1048576).toFixed(1)} MiB`);
		}
		for (const name of ['GEOLITE2_LICENSE', 'GEOLITE2_EULA']) {
			const response = await fetch(
				`https://raw.githubusercontent.com/sapics/ip-location-db/main/geolite2-city/${name}`,
				{ signal: AbortSignal.timeout(60000) }
			);
			if (!response.ok) throw new Error(`GeoIP license HTTP ${response.status}`);
			await writeFile(join(staging, name), await response.text());
		}
		await writeFile(
			join(staging, 'manifest.json'),
			JSON.stringify(
				{
					format: 1,
					provider: 'github-releases',
					createdAt: new Date().toISOString(),
					release: release.html_url,
					files
				},
				null,
				2
			) + '\n'
		);
		// Publish only after both families and notices pass validation. A failed download leaves the previous cache intact.
		await mkdir(target, { recursive: true });
		for (const name of [
			'ipv4.bin',
			'ipv6.bin',
			'GEOLITE2_LICENSE',
			'GEOLITE2_EULA',
			'manifest.json'
		]) {
			await rename(join(staging, name), join(target, name));
		}
	} finally {
		await rm(staging, { recursive: true, force: true });
	}
}
