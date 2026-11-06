import { isIP } from 'node:net';

export const HEADER_SIZE = 16;
const MAGIC = 'CTGEO001';
export const recordSize = (family) => (family === 4 ? 20 : 44);

/** Parse without losing any of IPv6's 128 bits. */
export function addressBytes(address, normalizeMapped = false) {
	const family = isIP(address);
	if (!family || address.includes('%')) return null;
	if (family === 4) return Buffer.from(address.split('.').map(Number));
	let text = address;
	if (text.includes('.')) {
		const colon = text.lastIndexOf(':');
		const octets = text
			.slice(colon + 1)
			.split('.')
			.map(Number);
		text =
			text.slice(0, colon + 1) +
			((octets[0] << 8) | octets[1]).toString(16) +
			':' +
			((octets[2] << 8) | octets[3]).toString(16);
	}
	const halves = text.split('::');
	const left = halves[0] ? halves[0].split(':') : [];
	const right = halves[1] ? halves[1].split(':') : [];
	const groups =
		halves.length === 2
			? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right]
			: left;
	const bytes = Buffer.alloc(16);
	groups.forEach((group, index) => bytes.writeUInt16BE(parseInt(group, 16), index * 2));
	if (
		normalizeMapped &&
		bytes.subarray(0, 12).equals(Buffer.from('00000000000000000000ffff', 'hex'))
	)
		return bytes.subarray(12);
	return bytes;
}

export function databaseHeader(family, count) {
	const header = Buffer.alloc(HEADER_SIZE);
	header.write(MAGIC);
	header.writeUInt32BE(family, 8);
	header.writeUInt32BE(count, 12);
	return header;
}

export function validateDatabase(buffer, family) {
	if (
		buffer.length < HEADER_SIZE ||
		buffer.toString('ascii', 0, 8) !== MAGIC ||
		buffer.readUInt32BE(8) !== family ||
		buffer.length !== HEADER_SIZE + buffer.readUInt32BE(12) * recordSize(family)
	) {
		throw new Error('Invalid GeoIP database header or length');
	}
	return buffer;
}

export function lookupAddress(buffer, address) {
	const width = address.length;
	const size = recordSize(width === 4 ? 4 : 6);
	let lo = 0;
	let hi = buffer.readUInt32BE(12);
	// Upper bound of range starts; the preceding record is the only candidate.
	while (lo < hi) {
		const mid = Math.floor((lo + hi) / 2);
		const offset = HEADER_SIZE + mid * size;
		if (Buffer.compare(buffer.subarray(offset, offset + width), address) <= 0) lo = mid + 1;
		else hi = mid;
	}
	if (lo === 0) return null;
	const offset = HEADER_SIZE + (lo - 1) * size;
	if (Buffer.compare(address, buffer.subarray(offset + width, offset + width * 2)) > 0) return null;
	return {
		latitude: buffer.readFloatBE(offset + width * 2),
		longitude: buffer.readFloatBE(offset + width * 2 + 4),
		zoom: buffer.readFloatBE(offset + width * 2 + 8)
	};
}
