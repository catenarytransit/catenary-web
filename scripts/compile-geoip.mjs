#!/usr/bin/env node
import { createReadStream, closeSync, openSync, renameSync, unlinkSync, writeSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';

const HEADER = Buffer.from('CTGEOIP1');
const MASK64 = (1n << 64n) - 1n;
const MAX_IPV6 = (1n << 128n) - 1n;

function parseAddress(value, family) {
  if (!/^[0-9]+$/.test(value)) throw new Error('Invalid numeric IP range');
  const ip = BigInt(value);
  if (ip < 0n || ip > (family === 4 ? 0xffffffffn : MAX_IPV6)) {
    throw new Error('IP range outside address family');
  }
  return ip;
}

function writeAddress(record, offset, value, family) {
  if (family === 4) {
    record.writeUInt32BE(Number(value), offset);
  } else {
    record.writeBigUInt64BE(value >> 64n, offset);
    record.writeBigUInt64BE(value & MASK64, offset + 8);
  }
}

export async function compileGeoip(input, output, family) {
  if (family !== 4 && family !== 6) throw new Error('Unsupported IP family');
  const stride = family === 4 ? 16 : 40;
  const addressBytes = family === 4 ? 4 : 16;
  const temporary = output + '.tmp';
  const fd = openSync(temporary, 'w');
  let count = 0;
  let previousEnd = -1n;
  const batch = Buffer.allocUnsafe(stride * 2048);
  let used = 0;

  try {
    writeSync(fd, Buffer.alloc(12));

    const lines = createInterface({
      input: createReadStream(input).pipe(createGunzip()),
      crlfDelay: Infinity
    });

    for await (const line of lines) {
      if (!line.trim()) continue;
      // City names may contain quoted commas; the numeric fields at either
      // end of the record have fixed positions relative to the ends.
      const columns = line.split(',');
      if (columns[0] === 'ip_range_start') continue;
      if (columns.length < 10) throw new Error('Malformed city database record');

      const start = parseAddress(columns[0], family);
      const end = parseAddress(columns[1], family);
      const latitude = Number(columns.at(-3));
      const longitude = Number(columns.at(-2));

      if (start > end || start <= previousEnd) {
        throw new Error('IP ranges must be sorted, disjoint and nonempty');
      }
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
          latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        throw new Error('Invalid city coordinates');
      }
      if (count === 0xffffffff) throw new Error('Too many IP ranges');

      const record = batch.subarray(used, used + stride);
      writeAddress(record, 0, start, family);
      writeAddress(record, addressBytes, end, family);
      record.writeFloatLE(longitude, addressBytes * 2);
      record.writeFloatLE(latitude, addressBytes * 2 + 4);
      used += stride;
      count++;
      previousEnd = end;

      if (used === batch.length) {
        writeSync(fd, batch);
        used = 0;
      }
    }

    if (count === 0) throw new Error('Empty IP geolocation database');
    if (used) writeSync(fd, batch.subarray(0, used));
    const header = Buffer.alloc(12);
    HEADER.copy(header);
    header.writeUInt32LE(count, 8);
    writeSync(fd, header, 0, 12, 0);
    closeSync(fd);
    renameSync(temporary, output);
    return count;
  } catch (error) {
    closeSync(fd);
    try { unlinkSync(temporary); } catch {}
    throw error;
  }
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const [input, output, family] = process.argv.slice(2);
  if (!input || !output || !['4', '6'].includes(family)) {
    console.error('Usage: compile-geoip.mjs <numeric-city.csv.gz> <output.bin> <4|6>');
    process.exitCode = 2;
  } else {
    compileGeoip(input, output, Number(family))
      .then((count) => console.log(`Compiled ${count} IPv${family} ranges`))
      .catch((error) => { console.error(error); process.exitCode = 1; });
  }
}
