import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isIP } from 'node:net';

export type MapCenter = [longitude: number, latitude: number];

const HEADER = 'CTGEOIP1';
const HEADER_SIZE = 12;
const MASK64 = (1n << 64n) - 1n;

export class GeoipIndex {
  private readonly count: number;
  private readonly stride: number;

  constructor(private readonly data: Buffer, private readonly family: 4 | 6) {
    this.stride = family === 4 ? 16 : 40;
    if (data.length < HEADER_SIZE || data.toString('ascii', 0, 8) !== HEADER) {
      throw new Error('Invalid geolocation index header');
    }
    this.count = data.readUInt32LE(8);
    if (this.count === 0 || data.length !== HEADER_SIZE + this.count * this.stride) {
      throw new Error('Invalid geolocation index size');
    }
  }

  lookup(ip: string): MapCenter | null {
    if (isIP(ip) !== this.family) return null;
    const address = this.family === 4 ? ipv4Value(ip) : ipv6Value(ip);
    if (address === null) return null;

    let lo = 0;
    let hi = this.count;
    while (lo < hi) {
      const mid = lo + ((hi - lo) >>> 1);
      const offset = HEADER_SIZE + mid * this.stride;
      const start = this.readAddress(offset);
      if (address < start) {
        hi = mid;
        continue;
      }
      if (address > this.readAddress(offset + (this.family === 4 ? 4 : 16))) {
        lo = mid + 1;
        continue;
      }
      const valueOffset = offset + (this.family === 4 ? 8 : 32);
      return [
        this.data.readFloatLE(valueOffset),
        this.data.readFloatLE(valueOffset + 4)
      ];
    }
    return null;
  }

  private readAddress(offset: number): bigint {
    if (this.family === 4) return BigInt(this.data.readUInt32BE(offset));
    return (this.data.readBigUInt64BE(offset) << 64n) |
      this.data.readBigUInt64BE(offset + 8);
  }
}

function ipv4Value(ip: string): bigint {
  return ip.split('.').reduce((value, octet) => (value << 8n) | BigInt(octet), 0n);
}

function ipv6Value(ip: string): bigint | null {
  let normalized = ip.toLowerCase();
  // IPv4-compatible suffixes represent the final two hextets.
  if (normalized.includes('.')) {
    const colon = normalized.lastIndexOf(':');
    const octets = normalized.slice(colon + 1).split('.').map(Number);
    if (octets.length !== 4) return null;
    normalized = normalized.slice(0, colon + 1) +
      ((octets[0] << 8) | octets[1]).toString(16) + ':' +
      ((octets[2] << 8) | octets[3]).toString(16);
  }

  const parts = normalized.split('::');
  if (parts.length > 2) return null;
  const left = parts[0] ? parts[0].split(':') : [];
  const right = parts.length === 2 && parts[1] ? parts[1].split(':') : [];
  const gap = 8 - left.length - right.length;
  if ((parts.length === 1 && gap !== 0) ||
      (parts.length === 2 && gap < 1)) return null;
  const segments = [...left, ...Array(gap).fill('0'), ...right];
  if (segments.length !== 8) return null;
  let value = 0n;
  for (const segment of segments) value = (value << 16n) | BigInt(parseInt(segment, 16));
  return value;
}

let indexes: { ipv4: GeoipIndex; ipv6: GeoipIndex } | null = null;

export function warmGeoip(): void {
  if (indexes) return;
  const dir = resolve(process.env.GEOIP_DATA_DIR ?? 'geoip');
  indexes = {
    ipv4: new GeoipIndex(readFileSync(resolve(dir, 'dbip-city-ipv4.bin')), 4),
    ipv6: new GeoipIndex(readFileSync(resolve(dir, 'dbip-city-ipv6.bin')), 6)
  };
}

/** Synchronous, allocation-light lookup on already loaded local indexes. */
export function ipToCenter(ip: string): MapCenter | null {
  if (!indexes) warmGeoip();
  if (isIP(ip) === 4) return indexes!.ipv4.lookup(ip);
  if (isIP(ip) === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    if (mapped && isIP(mapped[1]) === 4) return indexes!.ipv4.lookup(mapped[1]);
    return indexes!.ipv6.lookup(ip);
  }
  return null;
}
