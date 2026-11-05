import type { Map } from 'maplibre-gl';

/** Keep nearby search movements animated; skip flights to distant off-screen results. */
export function flyToSearchLocation(map: Map | null, center: [number, number], zoom: number): void {
	if (!map || !center.every(Number.isFinite)) return;

	// Use the nearest world copy, including searches across the antimeridian.
	const longitude = center[0] + 360 * Math.round((map.getCenter().lng - center[0]) / 360);
	const target: [number, number] = [longitude, center[1]];
	const point = map.project(target);
	const { clientWidth: width, clientHeight: height } = map.getContainer();
	const edgeX = Math.max(0, Math.min(width, point.x));
	const edgeY = Math.max(0, Math.min(height, point.y));
	const offScreen = point.x < 0 || point.x > width || point.y < 0 || point.y > height;
	let instant = false;
	if (offScreen && width > 0 && height > 0) {
		// 200% means two full viewport widths/heights beyond the nearest edge.
		const farInPixels = Math.abs(point.x - edgeX) > 2 * width ||
			Math.abs(point.y - edgeY) > 2 * height;
		const farInMetres = map.unproject([edgeX, edgeY]).distanceTo(target) > 100_000;
		instant = farInPixels || farInMetres;
	}
	map.flyTo({ center: target, zoom, ...(instant ? { duration: 0 } : {}) });
}
