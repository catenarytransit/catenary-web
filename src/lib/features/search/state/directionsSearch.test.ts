import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	buildDirectionsSearchUrls,
	mergeDirectionsLocations,
	streamDirectionsLocations
} from './directionsSearch';

describe('Directions Cypress/Birch search', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('uses only existing Cypress and Birch endpoints with correctly encoded text', () => {
		const urls = buildDirectionsSearchUrls('Zürich & Hbf', {
			mapLat: 47.37, mapLon: 8.54, mapZoom: 12, userLat: 47.37, userLon: 8.54
		}, 'cypress');
		expect(new URL(urls.cypress).hostname).toBe('cypress.catenarymaps.org');
		expect(new URL(urls.cypress).searchParams.get('text')).toBe('Zürich & Hbf');
		expect(new URL(urls.station).pathname).toBe('/osm_station_search');
		expect(new URL(urls.transit).pathname).toBe('/text_search_v1');
		expect(new URL(urls.station).searchParams.get('focus_weight')).toBe('4');
	});

	it('streams Cypress locations before slow Birch requests and ignores transit routes', async () => {
		let finishStations!: (data: unknown) => void;
		let finishTransit!: (data: unknown) => void;
		vi.stubGlobal('fetch', vi.fn((url: string) => {
			const response = url.includes('/v2/search')
				? Promise.resolve({ features: [{
					geometry: { type: 'Point', coordinates: [8.54, 47.37] },
					properties: { id: 'node/123', name: 'Zürich HB', street: 'Bahnhofplatz' }
				}] })
				: url.includes('/osm_station_search')
					? new Promise((resolve) => { finishStations = resolve; })
					: new Promise((resolve) => { finishTransit = resolve; });
			return Promise.resolve({ ok: true, json: () => response });
		}));
		const updates: string[][] = [];
		const running = streamDirectionsLocations(
			'Zürich', { mapLat: 47.37, mapLon: 8.54, mapZoom: 12 },
			new AbortController().signal,
			(items) => updates.push(items.map((item) => item.name))
		);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(updates).toEqual([['Zürich HB']]);

		finishTransit({
			routes_section: { ranking: [{ gtfs_id: 'route1', chateau: 'test' }] },
			stops_section: {
				ranking: [{ chateau: 'test', gtfs_id: 'stop1' }],
				stops: { test: { stop1: { name: 'Bus Stop', point: { x: 8.5, y: 47.4 } } } }
			}
		});
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(updates.at(-1)).toEqual(['Zürich HB', 'Bus Stop']);
		finishStations({ results: [] });
		await running;
	});

	it('does not publish late responses after cancellation', async () => {
		const pending: Array<(value: unknown) => void> = [];
		vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
			ok: true,
			json: () => new Promise((resolve) => { pending.push(resolve); })
		})));
		const controller = new AbortController();
		const update = vi.fn();
		const running = streamDirectionsLocations(
			'station', { mapLat: 34, mapLon: -118, mapZoom: 12 }, controller.signal, update
		);
		await Promise.resolve();
		controller.abort();
		for (const resolve of pending) resolve({ features: [], results: [], stops_section: { ranking: [] } });
		await expect(running).rejects.toMatchObject({ name: 'AbortError' });
		expect(update).not.toHaveBeenCalled();
	});

	it('keeps unique entries in stable provider order', () => {
		const place = { key: 'cypress:node/1', kind: 'place' as const, name: 'City', address: '', lat: 34, lon: -118 };
		const station = { ...place, key: 'station:123', kind: 'station' as const, name: 'Station' };
		expect(mergeDirectionsLocations([place, place], [station], [])).toEqual([place, station]);
	});
});
