import { addressBytes, databaseHeader, recordSize } from '../src/lib/server/geoip/binary.mjs';
import { csvRows } from './geoip-csv.mjs';

/** Write in bounded batches instead of retaining CSV rows or JS range objects. */
export async function compileGeoip(chunks, family, file) {
	const size = recordSize(family),
		width = family === 4 ? 4 : 16;
	async function writeAll(buffer, position = null) {
		let offset = 0;
		while (offset < buffer.length) {
			const { bytesWritten } = await file.write(
				buffer,
				offset,
				buffer.length - offset,
				position === null ? null : position + offset
			);
			if (!bytesWritten) throw new Error('Unable to write GeoIP database');
			offset += bytesWritten;
		}
	}
	await writeAll(databaseHeader(family, 0));
	let count = 0,
		previousEnd = null,
		used = 0;
	let batch = Buffer.alloc(size * 16384);
	for await (const row of csvRows(chunks)) {
		if (row.length === 1 && row[0] === '') continue;
		if (row.length !== 10) throw new Error('Expected ten GeoIP CSV columns');
		const start = addressBytes(row[0]),
			end = addressBytes(row[1]);
		if (
			!start ||
			!end ||
			start.length !== width ||
			end.length !== width ||
			Buffer.compare(start, end) > 0 ||
			(previousEnd && Buffer.compare(previousEnd, start) >= 0)
		)
			throw new Error('Unsorted, overlapping, or invalid IP ranges');
		previousEnd = end;
		// Missing coordinates are unknown, never implicitly (0, 0).
		if (!row[7].trim() || !row[8].trim()) continue;
		const latitude = Number(row[7]),
			longitude = Number(row[8]);
		if (
			!Number.isFinite(latitude) ||
			!Number.isFinite(longitude) ||
			Math.abs(latitude) > 90 ||
			Math.abs(longitude) > 180
		)
			throw new Error('Invalid GeoIP coordinates');
		start.copy(batch, used);
		end.copy(batch, used + width);
		batch.writeFloatBE(latitude, used + width * 2);
		batch.writeFloatBE(longitude, used + width * 2 + 4);
		// Granularity is a camera heuristic, not an accuracy estimate.
		batch.writeFloatBE(row[5] ? 10 : row[3] || row[4] ? 6 : 4, used + width * 2 + 8);
		used += size;
		count++;
		if (used === batch.length) {
			await writeAll(batch);
			used = 0;
		}
	}
	if (used) await writeAll(batch.subarray(0, used));
	if (!count) throw new Error(`Empty IPv${family} GeoIP dataset`);
	await writeAll(databaseHeader(family, count), 0);
	return count;
}
