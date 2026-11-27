import { describe, expect, it } from 'vitest';
import type { FeatureCollection } from 'geojson';
import { activeFloodAlerts, alertUrl, alertFeatureUrl } from './floodAlerts';

describe('active flood alerts', () => {
	const onset = '2026-11-26T21:57:00-08:00';
	const ends = '2026-11-27T13:00:00-08:00';
	const data: FeatureCollection = { type: 'FeatureCollection', features: [{
		type: 'Feature', geometry: { type: 'Point', coordinates: [-118, 34] },
		properties: { prod_type: 'Coastal Flood Warning', ONSET: onset, ENDS: ends }
	}] };
	it('includes onset and excludes end, respecting offsets', () => {
		expect(activeFloodAlerts(data, Date.parse(onset) - 1).features).toHaveLength(0);
		expect(activeFloodAlerts(data, Date.parse(onset)).features).toHaveLength(1);
		expect(activeFloodAlerts(data, Date.parse(ends) - 1).features).toHaveLength(1);
		expect(activeFloodAlerts(data, Date.parse(ends)).features).toHaveLength(0);
	});
	it('rejects invalid dates and non-flood events', () => {
		for (const properties of [{ ...data.features[0].properties, ENDS: null }, { ONSET: onset, ENDS: ends, prod_type: 'Wind Warning' }]) {
			expect(activeFloodAlerts({ ...data, features: [{ ...data.features[0], properties }] }, Date.parse(onset)).features).toHaveLength(0);
		}
	});
	it('accepts lowercase ArcGIS timestamps and epoch milliseconds', () => {
		for (const properties of [
			{ prod_type: 'Coastal Flood Warning', onset, ends },
			{ prod_type: 'Coastal Flood Warning', onset: Date.parse(onset), ends: Date.parse(ends) },
			{ prod_type: 'Coastal Flood Warning', onset, ENDS: ends }
		]) {
			const collection: FeatureCollection = { ...data, features: [{ ...data.features[0], properties }] };
			expect(activeFloodAlerts(collection, Date.parse(onset) - 1).features).toHaveLength(0);
			expect(activeFloodAlerts(collection, Date.parse(onset)).features).toHaveLength(1);
			expect(activeFloodAlerts(collection, Date.parse(ends)).features).toHaveLength(0);
		}
	});
	it('accepts both URL field casings', () => {
		const url = 'https://api.weather.gov/alerts/test';
		expect(alertFeatureUrl({ url })).toBe(url);
		expect(alertFeatureUrl({ URL: url })).toBe(url);
		expect(alertFeatureUrl({ url: 'https://example.com', URL: url })).toBe(url);
		expect(alertFeatureUrl(null)).toBeNull();
	});
	it('only allows NWS alert URLs', () => {
		expect(alertUrl('https://api.weather.gov/alerts/test')).not.toBeNull();
		expect(alertUrl('https://api.weather.gov.evil.example/alerts/test')).toBeNull();
		expect(alertUrl('javascript:alert(1)')).toBeNull();
	});
});
