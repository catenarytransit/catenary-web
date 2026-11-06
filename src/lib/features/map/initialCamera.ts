export interface InitialCamera {
	longitude: number;
	latitude: number;
	zoom: number;
}

export const WORLD_CAMERA: InitialCamera = { longitude: 0, latitude: 20, zoom: 2 };

export function selectInitialCamera(
	previous: unknown,
	server: InitialCamera | null
): InitialCamera {
	if (
		previous &&
		typeof previous === 'object' &&
		'longitude' in previous &&
		'latitude' in previous &&
		typeof previous.longitude === 'number' &&
		Number.isFinite(previous.longitude) &&
		Math.abs(previous.longitude) <= 180 &&
		typeof previous.latitude === 'number' &&
		Number.isFinite(previous.latitude) &&
		Math.abs(previous.latitude) <= 90
	) {
		return { longitude: previous.longitude, latitude: previous.latitude, zoom: 10 };
	}
	return server ?? WORLD_CAMERA;
}
