import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

/**
 * Configure MapLibre before constructing any Map, including on standalone routes.
 * MapLibre GL JS v6 needs an explicit worker URL with Vite/SvelteKit.
 */
export function configureMapLibreWorkers(): void {
	// Plain ?url emits an unbundled .mjs file whose shared-module import can fail
	// after deployment. ?worker&url lets Vite bundle its dependencies and serve
	// the worker as a same-origin asset with a content-hashed URL.
	maplibregl.setWorkerUrl(maplibreWorkerUrl);
	maplibregl.setWorkerCount(navigator.hardwareConcurrency > 10 ? navigator.hardwareConcurrency : 4);
}
