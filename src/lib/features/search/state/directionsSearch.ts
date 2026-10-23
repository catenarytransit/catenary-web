/**
 * Directions-only location autocomplete. Keep the regular search API, ranking,
 * result previews and stores untouched. Each provider publishes independently.
 */
export interface DirectionsSearchFocus {
	mapLat: number;
	mapLon: number;
	mapZoom: number;
	userLat?: number;
	userLon?: number;
}

export interface DirectionsLocation {
	key: string;
	kind: 'place' | 'station' | 'stop';
	name: string;
	address: string;
	lat: number;
	lon: number;
}

type CypressFeature = {
	geometry?: { type?: string; coordinates?: number[] };
	properties?: {
		id?: string;
		name?: string;
		layer?: string;
		categories?: string[];
		housenumber?: string;
		street?: string;
		locality?: string;
		neighbourhood?: string;
		county?: string;
		region?: string;
		country?: string;
		display_name?: string;
	};
};

interface CypressResponse {
	features?: CypressFeature[];
}

interface StationResponse {
	results?: Array<{
		osm_id: number | string;
		name: string | null;
		point: { x: number; y: number } | null;
		admin_hierarchy?: {
			neighbourhood?: { name?: string } | null;
			county?: { name?: string } | null;
			region?: { name?: string } | null;
		};
	}>;
}

interface TransitResponse {
	stops_section?: {
		stops?: Record<string, Record<string, {
			name?: string;
			code?: string | null;
			point?: { x: number; y: number } | null;
			parent_station?: string | null;
			osm_station_id?: string | number | null;
		}>>;
		ranking?: Array<{ chateau: string; gtfs_id: string }>;
	};
}

export type DirectionsSource = 'cypress' | 'station' | 'transit';

export function isValidCoordinates(lat: number, lon: number): boolean {
	return Number.isFinite(lat) && Number.isFinite(lon) &&
		lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function formatAddress(parts: Array<string | null | undefined>): string {
	const included = new Set<string>();
	return parts.flatMap((part) => {
		const clean = part?.trim();
		if (!clean || included.has(clean.toLocaleLowerCase())) return [];
		included.add(clean.toLocaleLowerCase());
		return [clean];
	}).join(', ');
}

export function buildDirectionsSearchUrls(
	text: string,
	focus: DirectionsSearchFocus,
	cypressHost: string
): Record<DirectionsSource, string> {
	const zoom = Math.round(focus.mapZoom);
	const focusWeight = zoom > 13 ? 5 : zoom > 10 ? 4 : zoom < 7 ? 2 : 3;

	const cypress = new URL('https://' + cypressHost + '.catenarymaps.org/v2/search');
	cypress.searchParams.set('text', text);
	cypress.searchParams.set('focus.point.lat', String(focus.mapLat));
	cypress.searchParams.set('focus.point.lon', String(focus.mapLon));
	cypress.searchParams.set('focus.point.weight', String(focusWeight));

	const station = new URL('https://birch_search.catenarymaps.org/osm_station_search');
	station.searchParams.set('text', text);
	const hasUserLocation = isValidCoordinates(focus.userLat ?? NaN, focus.userLon ?? NaN);
	if (hasUserLocation) {
		// Matches the regular search bar: map-based station bias only if geolocated.
		station.searchParams.set('focus_lat', String(focus.mapLat));
		station.searchParams.set('focus_lon', String(focus.mapLon));
		station.searchParams.set('focus_weight', String(focusWeight));
	}

	const transit = new URL('https://birch_search.catenarymaps.org/text_search_v1');
	transit.searchParams.set('text', text);
	transit.searchParams.set('map_lat', String(focus.mapLat));
	transit.searchParams.set('map_lon', String(focus.mapLon));
	transit.searchParams.set('map_z', String(zoom));
	if (hasUserLocation) {
		transit.searchParams.set('user_lat', String(focus.userLat));
		transit.searchParams.set('user_lon', String(focus.userLon));
	}

	return { cypress: cypress.toString(), station: station.toString(), transit: transit.toString() };
}

function parseCypress(response: CypressResponse): DirectionsLocation[] {
	const rows: DirectionsLocation[] = [];
	for (const feature of response.features?.slice(0, 10) ?? []) {
		const properties = feature.properties;
		const coordinates = feature.geometry?.coordinates;
		if (!properties?.name?.trim() || feature.geometry?.type !== 'Point' ||
			!Array.isArray(coordinates) || coordinates.length < 2) continue;
		const [lon, lat] = coordinates;
		if (!isValidCoordinates(lat, lon)) continue;
		if (properties.layer?.toLowerCase() === 'route' ||
			properties.categories?.includes('route')) continue;
		const streetAddress = [properties.housenumber, properties.street].filter(Boolean).join(' ');
		rows.push({
			key: 'cypress:' + (properties.id || lat + ',' + lon + ':' + properties.name),
			kind: 'place',
			name: properties.name,
			address: formatAddress([
				streetAddress,
				properties.neighbourhood,
				properties.locality,
				properties.county,
				properties.region,
				properties.country
			]) || properties.display_name || '',
			lat,
			lon
		});
	}
	return rows;
}

function parseStations(response: StationResponse): DirectionsLocation[] {
	const rows: DirectionsLocation[] = [];
	for (const station of response.results?.slice(0, 10) ?? []) {
		if (!station.name?.trim() || !station.point ||
			!isValidCoordinates(station.point.y, station.point.x)) continue;
		rows.push({
			key: 'station:' + station.osm_id,
			kind: 'station',
			name: station.name,
			address: formatAddress([
				station.admin_hierarchy?.neighbourhood?.name,
				station.admin_hierarchy?.county?.name,
				station.admin_hierarchy?.region?.name
			]),
			lat: station.point.y,
			lon: station.point.x
		});
	}
	return rows;
}

function parseStops(response: TransitResponse): DirectionsLocation[] {
	const section = response.stops_section;
	const rows: DirectionsLocation[] = [];
	for (const ranked of section?.ranking?.slice(0, 10) ?? []) {
		const stop = section?.stops?.[ranked.chateau]?.[ranked.gtfs_id];
		if (!stop?.name?.trim() || !stop.point || stop.parent_station ||
			stop.osm_station_id != null || !isValidCoordinates(stop.point.y, stop.point.x)) continue;
		rows.push({
			key: 'stop:' + ranked.chateau + ':' + ranked.gtfs_id,
			kind: 'stop',
			name: stop.name,
			address: stop.code || '',
			lat: stop.point.y,
			lon: stop.point.x
		});
	}
	return rows;
}

export function mergeDirectionsLocations(
	cypress: DirectionsLocation[],
	stations: DirectionsLocation[],
	stops: DirectionsLocation[]
): DirectionsLocation[] {
	const seen = new Set<string>();
	const result: DirectionsLocation[] = [];
	// Prefer Birch station matches over general Cypress places and Birch GTFS stops,
	// even if the station request finishes after another provider.
	for (const item of [...stations, ...cypress, ...stops]) {
		if (seen.has(item.key)) continue;
		seen.add(item.key);
		result.push(item);
		if (result.length === 30) break;
	}
	return result;
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
	const response = await fetch(url, { mode: 'cors', signal });
	if (!response.ok) throw new Error('Location search request failed: HTTP ' + response.status);
	return response.json() as Promise<T>;
}

/**
 * Immediately starts the same three requests as the regular search bar.
 * Results are emitted after EACH response, not after all responses complete.
 * Never returns route sections or route preview information to Directions.
 */
export async function streamDirectionsLocations(
	text: string,
	focus: DirectionsSearchFocus,
	signal: AbortSignal,
	onUpdate: (locations: DirectionsLocation[]) => void
): Promise<void> {
	if (!text.trim() || signal.aborted) return;
	const hosts = ['cypress', 'cypress1', 'cypress2'];
	const urls = buildDirectionsSearchUrls(text, focus, hosts[Math.floor(Math.random() * hosts.length)]);

	let places: DirectionsLocation[] = [];
	let stations: DirectionsLocation[] = [];
	let stops: DirectionsLocation[] = [];
	const publish = () => {
		if (!signal.aborted) onUpdate(mergeDirectionsLocations(places, stations, stops));
	};

	// Attach independent completion handlers. Do not await slower Birch before
	// updating Cypress results (or vice versa).
	const outcomes = await Promise.allSettled([
		fetchJson<CypressResponse>(urls.cypress, signal).then((data) => {
			places = parseCypress(data);
			publish();
		}),
		fetchJson<StationResponse>(urls.station, signal).then((data) => {
			stations = parseStations(data);
			publish();
		}),
		fetchJson<TransitResponse>(urls.transit, signal).then((data) => {
			stops = parseStops(data);
			publish();
		})
	]);
	if (signal.aborted) throw new DOMException('Cancelled search', 'AbortError');
	if (outcomes.every((outcome) => outcome.status === 'rejected')) {
		throw new Error('All location search endpoints failed');
	}
}
