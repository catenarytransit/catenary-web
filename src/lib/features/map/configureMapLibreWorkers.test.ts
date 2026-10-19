import { afterEach, describe, expect, it, vi } from 'vitest';
import * as maplibregl from 'maplibre-gl';
import { configureMapLibreWorkers } from './configureMapLibreWorkers';

vi.mock('maplibre-gl', () => ({
	setWorkerUrl: vi.fn(),
	setWorkerCount: vi.fn()
}));

describe('configureMapLibreWorkers', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it('sets a Vite-provided worker URL before a map is constructed', () => {
		vi.stubGlobal('navigator', { hardwareConcurrency: 8 });
		configureMapLibreWorkers();

		expect(maplibregl.setWorkerUrl).toHaveBeenCalledOnce();
		expect(maplibregl.setWorkerUrl).toHaveBeenCalledWith(expect.any(String));
		expect(maplibregl.setWorkerUrl).not.toHaveBeenCalledWith('');
		expect(maplibregl.setWorkerCount).toHaveBeenCalledWith(4);
	});

	it('preserves the main map worker-count behavior on high-core devices', () => {
		vi.stubGlobal('navigator', { hardwareConcurrency: 12 });
		configureMapLibreWorkers();

		expect(maplibregl.setWorkerCount).toHaveBeenCalledWith(12);
	});
});
