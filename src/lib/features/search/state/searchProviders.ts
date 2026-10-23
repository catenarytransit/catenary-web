/**
 * Shared geocoding and transit search endpoints for the map search and trip planner.
 * Photon results are adapted to the existing GeoJSON marker/OSM selection format.
 */
export interface SearchFocus {
	lat: number;
	lon: number;
	zoom: number;
	userLat?: number;
	userLon?: number;
}

export interface PhotonResponse {
	type?: string;
	features?: PhotonFeature[];
}

interface PhotonFeature {
	type?: string;
	geometry?: { type?: string; coordinates?: number[] };
	properties?: {
		osm_type?: string;
		osm_id?: number | string;
		osm_key?: string;
		osm_value?: string;
		type?: string;
		name?: string;
		housenumber?: string;
		street?: string;
		locality?: string;
		district?: string;
		city?: string;
		county?: string;
		state?: string;
		postcode?: string;
		country?: string;
	};
}

export interface GeocodedFeature {
	type: 'Feature';
	geometry: { type: 'Point'; coordinates: [number, number] };
	properties: {
		id: string;
		layer: string;
		name: string;
		confidence: number;
		categories: string[];
		housenumber?: string;
		street?: string;
		postcode?: string;
		country?: string;
		region?: string;
		county?: string;
		locality?: string;
		neighbourhood?: string;
	};
}

export interface GeocodedFeatureCollection {
	type: 'FeatureCollection';
	features: GeocodedFeature[];
}

export interface DirectionsSuggestion {
	id: string;
	kind: 'place' | 'station' | 'stop';
	name: string;
	address: string;
	lat: number;
	lon: number;
}

interface StationResponse {
	results?: Array<{
		osm_id: number | string;
		name: string | null;
		point: { x: number; y: number } | null;
		admin_hierarchy?: Record<string, { name?: string } | null>;
	}>;
}

interface TransitResponse {
	stops_section?: {
		stops?: Record<string, Record<string, {
			name?: string;
			code?: string;
			point?: { x: number; y: number };
			parent_station?: string | null;
			osm_station_id?: string | number | null;
		}>>;
		ranking?: Array<{ chateau: string; gtfs_id: string }>;
	};
}

function validCoordinates(lat: number, lon: number): boolean {
	return Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
		Number.isFinite(lon) && lon >= -180 && lon <= 180;
}

export function buildPhotonSearchUrl(text: string, focus?: SearchFocus): string {
	const url = new URL('https://photon.komoot.io/api/');
	url.searchParams.set('q', text);
	url.searchParams.set('limit', '10');
	if (focus && validCoordinates(focus.lat, focus.lon)) {
		url.searchParams.set('lat', String(focus.lat));
		url.searchParams.set('lon', String(focus.lon));
		url.searchParams.set('zoom', String(Number.isFinite(focus.zoom) ? Math.trunc(Math.max(0, Math.min(20, focus.zoom))) : 12));
		url.searchParams.set('location_bias_scale', '0.1');
	}
	return url.toString();
}

export function buildTransitSearchUrl(text: string, focus?: SearchFocus): string {
	const url = new URL('https://birch_search.catenarymaps.org/text_search_v1');
	url.searchParams.set('text', text);
	if (focus && validCoordinates(focus.lat, focus.lon)) {
		url.searchParams.set('map_lat', String(focus.lat));
		url.searchParams.set('map_lon', String(focus.lon));
		url.searchParams.set('map_z', String(Math.round(focus.zoom)));
	}
	if (focus && validCoordinates(focus.userLat ?? NaN, focus.userLon ?? NaN)) {
		url.searchParams.set('user_lat', String(focus.userLat));
		url.searchParams.set('user_lon', String(focus.userLon));
	}
	return url.toString();
}

export function buildStationSearchUrl(text: string, focus?: SearchFocus): string {
	const url = new URL('https://birch_search.catenarymaps.org/osm_station_search');
	url.searchParams.set('text', text);
	// Keep the map-search station ranking behavior: focus only with user geolocation.
	if (focus && validCoordinates(focus.userLat ?? NaN, focus.userLon ?? NaN) &&
		validCoordinates(focus.lat, focus.lon)) {
		const weight = focus.zoom > 13 ? 5 : focus.zoom > 10 ? 4 : focus.zoom < 7 ? 2 : 3;
		url.searchParams.set('focus_lat', String(focus.lat));
		url.searchParams.set('focus_lon', String(focus.lon));
		url.searchParams.set('focus_weight', String(weight));
	}
	return url.toString();
}

export function photonToGeocodedFeatures(response: PhotonResponse): GeocodedFeatureCollection {
	const source = Array.isArray(response?.features) ? response.features : [];
	const features: GeocodedFeature[] = [];
	for (const [index, feature] of source.entries()) {
		if (feature?.type && feature.type !== 'Feature') continue;
		const properties = feature?.properties;
		const coords = feature?.geometry?.coordinates;
		if (!properties || feature?.geometry?.type !== 'Point' || !Array.isArray(coords)) continue;
		const [lon, lat] = coords;
		if (!validCoordinates(lat, lon)) continue;
		if (typeof properties.osm_id === 'number' && !Number.isSafeInteger(properties.osm_id)) continue;
		const id = String(properties.osm_id ?? '');
		if (!/^[1-9][0-9]*$/.test(id)) continue;
		const osmClass = ({ N: 'node', W: 'way', R: 'relation' } as Record<string, string>)[properties.osm_type ?? ''];
		if (!osmClass) continue;
		const name = properties.name?.trim();
		if (!name) continue;
		// Routes are not useful as address or location suggestions.
		if (properties.osm_key === 'route' || properties.osm_value === 'route') continue;
		const category = properties.osm_key && properties.osm_value
			? [properties.osm_key + ':' + properties.osm_value] : [];
		features.push({
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [lon, lat] },
			properties: {
				id: osmClass + '/' + id,
				name,
				layer: properties.osm_value || properties.type || properties.osm_key || 'place',
				categories: category,
				confidence: 1000 * (source.length - index) / Math.max(1, source.length),
				housenumber: properties.housenumber,
				street: properties.street,
				postcode: properties.postcode,
				country: properties.country,
				region: properties.state,
				county: properties.county,
				locality: properties.city || properties.locality,
				neighbourhood: properties.district || properties.locality
			}
		});
	}
	return { type: 'FeatureCollection', features };
}

function address(parts: Array<string | null | undefined>): string {
	const seen = new Set<string>();
	return parts.filter((part): part is string => {
		if (!part?.trim()) return false;
		const key = part.trim().toLocaleLowerCase();
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	}).join(', ');
}

export function photonFeatureAddress(feature: GeocodedFeature): string {
	const p = feature.properties;
	return address([
		[p.housenumber, p.street].filter(Boolean).join(' '),
		p.neighbourhood,
		p.locality,
		p.county,
		p.region,
		p.postcode,
		p.country
	]);
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
	const response = await fetch(url, { signal, mode: 'cors' });
	if (!response.ok) throw new Error('Search request failed: HTTP ' + response.status);
	return response.json() as Promise<T>;
}

/**
 * Start all three providers immediately. Publish each successful response as soon as it
 * arrives; in particular, slow Birch requests must never block Photon suggestions.
 * Photon stays first and stations/stops are appended without replacing selected items.
 */
export async function streamDirectionsSuggestions(
	text: string,
	focus: SearchFocus | undefined,
	signal: AbortSignal,
	onUpdate: (suggestions: DirectionsSuggestion[]) => void
): Promise<void> {
	let photon: DirectionsSuggestion[] = [];
	let stations: DirectionsSuggestion[] = [];
	let stops: DirectionsSuggestion[] = [];

	function publish(): void {
		if (signal.aborted) return;
		const seen = new Set<string>();
		const merged: DirectionsSuggestion[] = [];
		for (const candidate of [...photon, ...stations, ...stops]) {
			if (!validCoordinates(candidate.lat, candidate.lon) ||
				!candidate.name.trim() || seen.has(candidate.id)) continue;
			seen.add(candidate.id);
			merged.push(candidate);
			if (merged.length === 30) break;
		}
		onUpdate(merged);
	}

	const requests = [
		fetchJson<PhotonResponse>(buildPhotonSearchUrl(text, focus), signal).then((data) => {
			photon = photonToGeocodedFeatures(data).features.map((feature) => {
				const [lon, lat] = feature.geometry.coordinates;
				return {
					id: 'osm:' + feature.properties.id,
					kind: 'place' as const,
					name: feature.properties.name,
					address: photonFeatureAddress(feature),
					lat,
					lon
				};
			});
			publish();
		}),
		fetchJson<StationResponse>(buildStationSearchUrl(text, focus), signal).then((data) => {
			stations = (data.results ?? []).slice(0, 10).flatMap((station) => {
				if (!station.point || !station.name) return [];
				const hierarchy = station.admin_hierarchy;
				return [{
					id: 'station:' + station.osm_id,
					kind: 'station' as const,
					name: station.name,
					address: address([
						hierarchy?.neighbourhood?.name,
						hierarchy?.county?.name,
						hierarchy?.region?.name
					]),
					lat: station.point.y,
					lon: station.point.x
				}];
			});
			publish();
		}),
		fetchJson<TransitResponse>(buildTransitSearchUrl(text, focus), signal).then((data) => {
			const section = data.stops_section;
			stops = (section?.ranking ?? []).slice(0, 10).flatMap((ranked) => {
				const stop = section?.stops?.[ranked.chateau]?.[ranked.gtfs_id];
				if (!stop?.name || !stop.point || stop.parent_station ||
					stop.osm_station_id != null) return [];
				return [{
					id: 'gtfs:' + ranked.chateau + ':' + ranked.gtfs_id,
					kind: 'stop' as const,
					name: stop.name,
					address: stop.code || '',
					lat: stop.point.y,
					lon: stop.point.x
				}];
			});
			publish();
		})
	];
	const completed = await Promise.allSettled(requests);
	if (signal.aborted) throw new DOMException('Search cancelled', 'AbortError');
	if (completed.every((outcome) => outcome.status === 'rejected')) {
		throw new Error('All location search providers failed');
	}
}
