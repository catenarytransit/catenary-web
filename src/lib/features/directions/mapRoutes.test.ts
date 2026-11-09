import { describe, expect, it, vi } from 'vitest';
import type { Map } from 'maplibre-gl';
import polyline from '@mapbox/polyline';
import type { EdelweissItinerary } from './edelweiss';
import { clearDirectionsContext, fitDirectionsItinerary, refreshDirectionsSource } from './mapRoutes';

describe('journey bounds', () => {
	it('fits the complete journey with equal horizontal margins inside the sidebar-padded map', () => {
		const fitBounds = vi.fn();
		const map = { fitBounds } as unknown as Map;
		const itinerary: EdelweissItinerary = {
			startTime: '', endTime: '', duration: 600,
			legs: [{ mode: 'BUS', duration: 600,
				from: { name: 'Origin', lon: -118, lat: 34 }, to: { name: 'Destination', lon: -117.9, lat: 34.1 },
				legGeometry: { points: polyline.encode([[34, -118], [34.2, -118.1], [34.1, -117.9]], 6), precision: 6 }
			}]
		};

		fitDirectionsItinerary(map, itinerary);

		// Include the intermediate shape point, not only the leg endpoints. The
		// extra inset must not reserve the sidebar again (or use a desktop inset on mobile).
		expect(fitBounds).toHaveBeenCalledExactlyOnceWith(
			[[-118.1, 34], [-117.9, 34.2]],
			{ padding: { top: 85, bottom: 65, left: 45, right: 45 }, maxZoom: 15, duration: 550 }
		);
	});

	it('does not move the camera for a journey without coordinates', () => {
		const fitBounds = vi.fn();
		fitDirectionsItinerary({ fitBounds } as unknown as Map,
			{ startTime: '', endTime: '', duration: 0, legs: [] });
		expect(fitBounds).not.toHaveBeenCalled();
	});
});

describe('directions map cleanup', () => {
	it('clears route lines and transfer stops even while the style is loading', () => {
		const route = { setData: vi.fn() };
		const stops = { setData: vi.fn() };
		const map = {
			isStyleLoaded: () => false,
			getSource: (id: string) => id === 'edelweiss-directions' ? route : stops
		} as unknown as Map;

		refreshDirectionsSource(map, [], 0);

		expect(route.setData).toHaveBeenCalledWith({ type: 'FeatureCollection', features: [] });
		expect(stops.setData).toHaveBeenCalledWith({ type: 'FeatureCollection', features: [] });
	});

	it('empties previous context overlays without modifying unrelated map sources', () => {
		const ids = [
			'walking_shape_context', 'stops_context', 'transit_shape_context',
			'transit_shape_context_for_stop', 'transit_shape_context_detour',
			'livedots_context', 'cypress_results', 'redpin'
		];
		const sources = Object.fromEntries([...ids, 'buses'].map(id => [id, { setData: vi.fn() }]));
		const map = { getSource: (id: string) => sources[id] } as unknown as Map;

		clearDirectionsContext(map);

		for (const id of ids) {
			expect(sources[id].setData).toHaveBeenCalledWith({ type: 'FeatureCollection', features: [] });
		}
		expect(sources.buses.setData).not.toHaveBeenCalled();
	});

	it('allows entry before context sources have been added', () => {
		const map = { getSource: () => undefined } as unknown as Map;
		expect(() => clearDirectionsContext(map)).not.toThrow();
	});
});
