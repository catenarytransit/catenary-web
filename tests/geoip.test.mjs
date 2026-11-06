import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, open, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addressBytes, lookupAddress, validateDatabase } from '../src/lib/server/geoip/binary.mjs';
import { compileGeoip } from '../scripts/compile-geoip.mjs';
import { csvRows } from '../scripts/geoip-csv.mjs';
import { createGeoipLookup, visitorIp } from '../src/lib/server/geoip/index.mjs';
import { selectInitialCamera, WORLD_CAMERA } from '../src/lib/features/map/initialCamera.ts';

async function fixture(t, family, csv, directory) {
	directory ??= await mkdtemp(join(tmpdir(), 'catenary-geoip-'));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const path = join(directory, `ipv${family}.bin`);
	const file = await open(path, 'w');
	try {
		await compileGeoip([csv], family, file);
	} finally {
		await file.close();
	}
	return { directory, data: validateDatabase(await readFile(path), family) };
}

test('streaming CSV supports quotes, escaped quotes, Unicode, CRLF, and multiline fields across chunks', async () => {
	const source = 'a,"Montréal, ""x""\ncentre",z\r\n1,2,3';
	const rows = [];
	for await (const row of csvRows([...source])) rows.push(row);
	assert.deepEqual(rows, [
		['a', 'Montréal, "x"\ncentre', 'z'],
		['1', '2', '3']
	]);
	await assert.rejects(async () => {
		for await (const row of csvRows(['"unterminated'])) void row;
	}, /Unterminated/);
});

test('IPv4 binary search includes endpoints, excludes gaps, and keeps zero coordinates', async (t) => {
	const { data } = await fixture(
		t,
		4,
		'1.0.0.1,1.0.0.10,US,California,,Los Angeles,,34,-118,America/Los_Angeles\n' +
			'1.0.0.20,1.0.0.30,GB,,,,,0,0,\n' +
			'1.0.0.40,1.0.0.50,US,,,,,,,\n'
	);
	const lookup = (ip) => lookupAddress(data, addressBytes(ip));
	for (const ip of ['1.0.0.1', '1.0.0.5', '1.0.0.10'])
		assert.deepEqual(lookup(ip), { latitude: 34, longitude: -118, zoom: 10 });
	for (const ip of ['0.0.0.0', '1.0.0.11', '1.0.0.19', '1.0.0.31', '1.0.0.45', '255.255.255.255'])
		assert.equal(lookup(ip), null);
	assert.deepEqual(lookup('1.0.0.20'), { latitude: 0, longitude: 0, zoom: 4 });
	assert.throws(() => validateDatabase(data.subarray(0, -1), 4));
	assert.throws(() => validateDatabase(data, 6));
});

test('IPv6 retains all 128 bits, including adjacent ranges differing in the final bit', async (t) => {
	const { data } = await fixture(
		t,
		6,
		'2001:db8::1,2001:db8::2,JP,Tokyo,,Tokyo,,35,139,\n' +
			'2001:db8::3,2001:db8::3,US,California,,,,34,-118,\n'
	);
	assert.equal(
		lookupAddress(data, addressBytes('2001:0db8:0000:0000:0000:0000:0000:0002')).longitude,
		139
	);
	assert.equal(lookupAddress(data, addressBytes('2001:db8::3')).longitude, -118);
	assert.equal(lookupAddress(data, addressBytes('2001:db8::3')).zoom, 6);
	assert.equal(lookupAddress(data, addressBytes('2001:db8::4')), null);
	assert.equal(lookupAddress(data, addressBytes('2001:db8::')), null);
	assert.equal(
		addressBytes('::ffff:1.0.0.1', true).toString('hex'),
		addressBytes('1.0.0.1').toString('hex')
	);
	assert.equal(
		addressBytes('::ffff:100:1', true).toString('hex'),
		addressBytes('1.0.0.1').toString('hex')
	);
	for (const ip of ['junk', '', '1.0.0.1, 1.0.0.2', 'fe80::1%eth0', '999.1.1.1'])
		assert.equal(addressBytes(ip), null);
});

test('compiler rejects overlaps, incorrect families, malformed rows and invalid coordinates', async (t) => {
	for (const csv of [
		'1.0.0.1,1.0.0.10,US,,,,,34,-118,\n1.0.0.10,1.0.0.20,US,,,,,34,-118,',
		'::1,::2,US,,,,,34,-118,',
		'1.0.0.10,1.0.0.1,US,,,,,34,-118,',
		'1.0.0.1,1.0.0.2,US,,,,,91,-118,',
		'1.0.0.1,1.0.0.2,US,,,,,NaN,-118,',
		'broken,row'
	])
		await assert.rejects(fixture(t, 4, csv));
});

test('Cloudflare headers, concurrent lookup, mapped IPv4, and one-time database loading', async (t) => {
	const { directory } = await fixture(t, 4, '1.0.0.1,1.0.0.10,US,,,,,34,-118,');
	await fixture(t, 6, '2001:db8::1,2001:db8::2,JP,,,,,35,139,', directory);
	const lookup = createGeoipLookup([directory]);
	const results = await Promise.all(['1.0.0.1', '::ffff:1.0.0.1', '2001:db8::2'].map(lookup));
	assert.equal(results[0].longitude, -118);
	assert.deepEqual(results[0], results[1]);
	assert.equal(results[2].longitude, 139);
	await writeFile(join(directory, 'ipv4.bin'), 'corrupted after loading');
	assert.deepEqual(await lookup('1.0.0.1'), results[0]);
	assert.equal(await lookup(null), null);
	assert.equal(await lookup('127.0.0.1'), null);
	assert.equal(visitorIp(new Headers({ 'x-forwarded-for': '1.0.0.1' })), null);
	assert.equal(visitorIp(new Headers({ 'cf-connecting-ip': '1.0.0.1' })), '1.0.0.1');
	assert.equal(
		visitorIp(
			new Headers({ 'cf-connecting-ip': '240.1.0.1', 'cf-connecting-ipv6': '2001:db8::1' })
		),
		'2001:db8::1'
	);
});

test('unavailable database fails open and warns once', async () => {
	const warnings = [];
	const lookup = createGeoipLookup(['/nonexistent-catenary-geoip'], (message) =>
		warnings.push(message)
	);
	assert.equal(await lookup('1.0.0.1'), null);
	assert.equal(await lookup('1.0.0.2'), null);
	assert.equal(warnings.length, 1);
});

test('saved valid location wins, malformed saved locations use server camera, unknown uses world', () => {
	const server = { longitude: 139, latitude: 35, zoom: 10 };
	assert.deepEqual(selectInitialCamera({ longitude: -118, latitude: 34 }, server), {
		longitude: -118,
		latitude: 34,
		zoom: 10
	});
	for (const previous of [
		null,
		{},
		{ longitude: 181, latitude: 34 },
		{ longitude: 1, latitude: NaN }
	])
		assert.equal(selectInitialCamera(previous, server), server);
	assert.equal(selectInitialCamera(null, null), WORLD_CAMERA);
});
