import type { SearchResultItem } from '$lib/features/search/state/searchData';
import { getTopHistory } from '$lib/features/search/state/stationHistory';
import {
	isValidCoordinates,
	type DirectionsLocation
} from '$lib/features/search/state/directionsSearch';

const STORAGE_KEY = 'directions_recent_locations_v1';
const MAX_SAVED = 20;

function validLocation(value: unknown): value is DirectionsLocation {
	if (!value || typeof value !== 'object') return false;
	const item = value as Partial<DirectionsLocation>;
	return typeof item.key === 'string' && item.key !== 'user:location' &&
		(item.kind === 'place' || item.kind === 'station' || item.kind === 'stop') &&
		typeof item.name === 'string' && item.name.trim().length > 0 &&
		typeof item.address === 'string' &&
		isValidCoordinates(item.lat ?? NaN, item.lon ?? NaN);
}

function readSaved(): DirectionsLocation[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
		return Array.isArray(value) ? value.filter(validLocation) : [];
	} catch {
		return [];
	}
}

/** Convert visits from the main SearchBar into usable directions endpoints. */
export function searchHistoryLocation(item: SearchResultItem): DirectionsLocation | null {
	const data = item.data;
	if (!data) return null;
	let location: DirectionsLocation | null = null;

	if (item.type === 'stop') {
		location = {
			key: 'stop:' + (item.chateau ?? '') + ':' + (item.gtfs_id ?? ''),
			kind: 'stop', name: data.name ?? '', address: data.code ?? '',
			lat: data.point?.y, lon: data.point?.x
		};
	} else if (item.type === 'osm_station') {
		location = {
			key: 'station:' + data.osm_id,
			kind: 'station', name: data.name ?? '', address: '',
			lat: data.point?.y, lon: data.point?.x
		};
	} else if (item.type === 'osm_item') {
		location = {
			key: 'osm:' + data.osm_class + ':' + data.osm_id,
			kind: 'place', name: data.name ?? '', address: data.address ?? '',
			lat: data.lat, lon: data.lon
		};
	} else if (item.type === 'cypress') {
		const coordinates = data.geometry?.coordinates;
		location = {
			key: 'cypress:' + data.properties?.id,
			kind: 'place', name: data.properties?.name ?? '',
			address: data.properties?.display_name ?? '',
			lat: coordinates?.[1], lon: coordinates?.[0]
		};
	}

	return validLocation(location) ? location : null;
}

function identity(location: DirectionsLocation): string {
	// Cross-source deduplication: one physical location should not occur twice
	// merely because both Birch and Cypress (or a detail action) recorded it.
	return location.name.trim().toLocaleLowerCase() + ':' +
		location.lat.toFixed(5) + ':' + location.lon.toFixed(5);
}

export function getRecentDirectionsLocations(limit = 12): DirectionsLocation[] {
	const seen = new Set<string>();
	const recent: DirectionsLocation[] = [];
	for (const location of [
		...readSaved(),
		...getTopHistory(30).map(searchHistoryLocation)
	]) {
		if (!validLocation(location)) continue;
		const id = identity(location);
		if (seen.has(id)) continue;
		seen.add(id);
		recent.push(location);
		if (recent.length >= limit) break;
	}
	return recent;
}

/** Save explicit choices; do not persist the user's live GPS location. */
export function rememberDirectionsLocation(location: DirectionsLocation): void {
	if (!validLocation(location) || typeof localStorage === 'undefined') return;
	try {
		const id = identity(location);
		const next = [location, ...readSaved().filter((item) => identity(item) !== id)]
			.slice(0, MAX_SAVED);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	} catch {
		// Private browsing / quota restrictions should not block trip planning.
	}
}
