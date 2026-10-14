/**
 * Catenary's deployed OpenMapTiles POI feature IDs are encoded as
 * 10 * osmId + kind (1=node, 2=way, 3=relation). These are not raw OSM IDs.
 * Keep this decoder scoped to openmaptiles/poi; other tiles use other schemes.
 */
export type OsmObjectType = 'node' | 'way' | 'relation';
export interface OsmPoiId {
	osmId: string;
	osmClass: OsmObjectType;
	osmType: 'N' | 'W' | 'R';
}

export function decodeOpenMapTilesPoiId(value: string | number | null | undefined): OsmPoiId | null {
	if (value == null) return null;
	if (typeof value === 'number' && (!Number.isSafeInteger(value) || value <= 0)) return null;
	const raw = String(value);
	if (!/^[0-9]+$/.test(raw)) return null;
	const encoded = BigInt(raw);
	const id = encoded / 10n;
	if (id === 0n) return null;
	switch (encoded % 10n) {
		case 1n: return { osmId: id.toString(), osmClass: 'node', osmType: 'N' };
		case 2n: return { osmId: id.toString(), osmClass: 'way', osmType: 'W' };
		case 3n: return { osmId: id.toString(), osmClass: 'relation', osmType: 'R' };
		default: return null;
	}
}

export function parseCypressOsmId(raw: unknown): OsmPoiId | null {
	if (typeof raw !== 'string') return null;
	const match = /^(node|way|relation)\/([1-9][0-9]*)$/.exec(raw);
	if (!match) return null;
	const osmClass = match[1] as OsmObjectType;
	return {
		osmClass,
		osmId: match[2],
		osmType: osmClass === 'node' ? 'N' : osmClass === 'way' ? 'W' : 'R'
	};
}
