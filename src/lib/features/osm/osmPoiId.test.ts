import { describe, expect, it } from 'vitest';
import { decodeOpenMapTilesPoiId, parseCypressOsmId } from './osmPoiId';

describe('OpenMapTiles POI ID decoding', () => {
	it('maps the deployed type digit to the correct OSM object', () => {
		expect(decodeOpenMapTilesPoiId('35134799741')).toEqual({
			osmId: '3513479974', osmClass: 'node', osmType: 'N'
		});
		expect(decodeOpenMapTilesPoiId('67762119591')?.osmId).toBe('6776211959');
		expect(decodeOpenMapTilesPoiId('123452')).toEqual({
			osmId: '12345', osmClass: 'way', osmType: 'W'
		});
		expect(decodeOpenMapTilesPoiId('123453')?.osmClass).toBe('relation');
	});
	it('rejects unsafe, ambiguous or malformed identifiers', () => {
		for (const id of [null, undefined, 0, -10, 12.5, '0', '123450', '123454', '1e12', 'way/12', 'abc']) {
			expect(decodeOpenMapTilesPoiId(id)).toBeNull();
		}
		expect(decodeOpenMapTilesPoiId(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
	});
	it('parses Cypress native OSM references without applying tile decoding', () => {
		expect(parseCypressOsmId('way/123')).toEqual({
			osmId: '123', osmClass: 'way', osmType: 'W'
		});
		expect(parseCypressOsmId('place/123')).toBeNull();
		expect(parseCypressOsmId('node/-1')).toBeNull();
	});
});
