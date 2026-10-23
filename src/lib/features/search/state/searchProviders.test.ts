import { describe, expect, it } from 'vitest';
import { buildPhotonSearchUrl, buildStationSearchUrl, photonFeatureAddress, photonToGeocodedFeatures } from './searchProviders';

describe('Photon search adapter', () => {
	it('encodes search text and follows the Android location bias parameters', () => {
		const url = new URL(buildPhotonSearchUrl('Zürich H&B #1', { lat: 47.37, lon: 8.54, zoom: 13.5 }));
		expect(url.origin).toBe('https://photon.komoot.io');
		expect(url.searchParams.get('q')).toBe('Zürich H&B #1');
		expect(url.searchParams.get('limit')).toBe('10');
		expect(url.searchParams.get('zoom')).toBe('13');
		expect(url.searchParams.get('location_bias_scale')).toBe('0.1');
	});

	it('maps Photon OSM identifiers, coordinates and address fields', () => {
		const collection = photonToGeocodedFeatures({ features: [{
			type: 'Feature', geometry: { type: 'Point', coordinates: [8.54, 47.37] },
			properties: {
				osm_type: 'R', osm_id: 1682248, osm_key: 'place', osm_value: 'city',
				name: 'Zürich', city: 'Zürich', state: 'Zürich', country: 'Switzerland'
			}
		}] });
		expect(collection.features[0].properties.id).toBe('relation/1682248');
		expect(collection.features[0].properties.layer).toBe('city');
		expect(collection.features[0].geometry.coordinates).toEqual([8.54, 47.37]);
		expect(photonFeatureAddress(collection.features[0])).toBe('Zürich, Switzerland');
	});

	it('ignores malformed features and route objects', () => {
		const response = photonToGeocodedFeatures({ features: [
			{ geometry: { type: 'Point', coordinates: [999, 47] }, properties: { osm_type: 'N', osm_id: 12, name: 'Bad' } },
			{ geometry: { type: 'Point', coordinates: [8, 47] }, properties: { osm_type: 'W', osm_id: 13, osm_key: 'route', name: 'Route' } }
		] });
		expect(response.features).toHaveLength(0);
	});

	it('keeps the same station endpoint as map search', () => {
		const url = new URL(buildStationSearchUrl('Central', { lat: 34, lon: -118, zoom: 12, userLat: 34, userLon: -118 }));
		expect(url.pathname).toBe('/osm_station_search');
		expect(url.searchParams.get('focus_weight')).toBe('4');
	});
});
