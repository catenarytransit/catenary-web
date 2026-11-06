import { describe, expect, it, vi } from 'vitest';
import type { Map } from 'maplibre-gl';
import { clearDirectionsContext, refreshDirectionsSource } from './mapRoutes';

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
