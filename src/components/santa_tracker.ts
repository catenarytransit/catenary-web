/**
 * Santa Tracker Module for Catenary Maps
 *
 * Tracks Santa's real-time location during the 72-hour Christmas window
 * by interpolating his position along the official route.
 *
 * Active: December 23 12:00:00 to December 26 12:00:00 (local time)
 * Polling: Updates position every second, syncs with API every 60s
 */

import * as maplibregl from 'maplibre-gl';

interface SantaApiResponse {
	status: string;
	v: string;
	now: number;
	takeoff: number;
	duration: number;
	location: string;
	route: string[];
}

interface Destination {
	id: string;
	arrival: number;
	departure: number;
	location: { lat: number; lng: number };
	city: string;
	region: string;
	presentsDelivered?: number;
}

interface RouteResponse {
	destinations: Destination[];
}

const SANTA_API_URL = 'https://santa-api.appspot.com/info?client=web';
const SANTA_SOURCE_ID = 'santa-location';
const SANTA_LAYER_ID = 'santa-marker';
const ROUTE_SOURCE_ID = 'santa-route-line';
const ROUTE_LAYER_ID = 'santa-route-path';

let processingIntervalId: number | null = null;
let currentMap: maplibregl.Map | null = null;
let routeDestinations: Destination[] = [];
let timeOffset = 0; // Difference between local clock and Santa server time
let lastSyncTime = 0;

/**
 * Check if current time is within the 72-hour Christmas window.
 * Expanded window for testing/verification if needed.
 */
export function isChristmasWindow(): boolean {
	const now = new Date();
	const year = now.getFullYear();
	// Dec 23 12:00 to Dec 26 12:00
	const start = new Date(year, 11, 23, 12, 0, 0);
	const end = new Date(year, 11, 26, 12, 0, 0);
	return now >= start && now <= end;
}

/**
 * Fetch initial data: Info and Route
 */
async function initializeData(): Promise<boolean> {
	try {
		console.log('🎅 Fetching Santa API info...');
		const infoRes = await fetch(SANTA_API_URL);
		if (!infoRes.ok) return false;

		const info: SantaApiResponse = await infoRes.json();
		const now = Date.now();
		timeOffset = info.now - now; // Server time minus local time

		// Get route URL (try first one, fallback to hardcoded if needed)
		let routeUrl = info.route && info.route.length > 0 ? info.route[0] : null;
		if (!routeUrl) {
			console.error('🎅 No route URL found in Santa API');
			return false;
		}

		console.log(`🎅 Fetching Santa route from ${routeUrl}...`);
		const routeRes = await fetch(routeUrl);
		if (!routeRes.ok) return false;

		const routeData: RouteResponse = await routeRes.json();
		let destinations = routeData.destinations;

		if (!destinations || destinations.length === 0) return false;

		// Rebase timestamps if they are from a previous year
		// We assume info.takeoff is the correct current year takeoff time
		// and align the route's first departure (Santa's Village) to it.
		const takeoff = info.takeoff;
		const firstStop = destinations[0];

		// If the first stop's departure is significantly different from info.takeoff (e.g. > 30 days)
		// we assume the route file is stale/template and needs shifting.
		const diff = Math.abs(takeoff - firstStop.departure);
		const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

		if (diff > THIRTY_DAYS) {
			console.log('🎅 Rebasing route timestamps to current year...');
			const shift = takeoff - firstStop.departure;
			destinations = destinations.map((d) => ({
				...d,
				arrival: d.arrival + shift,
				departure: d.departure + shift
			}));
		}

		routeDestinations = destinations;
		console.log(`🎅 Loaded ${destinations.length} destinations.`);

		drawRoutePath();
		return true;
	} catch (e) {
		console.error('🎅 Error initializing Santa data:', e);
		return false;
	}
}

/**
 * Draw the full route line on the map
 */
function drawRoutePath() {
	if (!currentMap || routeDestinations.length === 0) return;

	// Create LineString coordinates
	const coords = routeDestinations.map((d) => [d.location.lng, d.location.lat]);

	// Add Source
	if (!currentMap.getSource(ROUTE_SOURCE_ID)) {
		currentMap.addSource(ROUTE_SOURCE_ID, {
			type: 'geojson',
			data: {
				type: 'Feature',
				geometry: {
					type: 'LineString',
					coordinates: coords
				},
				properties: {}
			}
		});
	} else {
		(currentMap.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource).setData({
			type: 'Feature',
			geometry: {
				type: 'LineString',
				coordinates: coords
			},
			properties: {}
		});
	}

	// Add Layer
	if (!currentMap.getLayer(ROUTE_LAYER_ID)) {
		currentMap.addLayer(
			{
				id: ROUTE_LAYER_ID,
				type: 'line',
				source: ROUTE_SOURCE_ID,
				layout: {
					'line-join': 'round',
					'line-cap': 'round'
				},
				paint: {
					'line-color': '#c41e3a', // Santa Red
					'line-width': 2,
					'line-opacity': 0.6,
					'line-dasharray': [1, 2] // Dashed line
				}
			},
			SANTA_LAYER_ID
		); // Draw beneath the Santa marker
	}
}

/**
 * Calculate current interpolated position
 */
function calculatePosition(): [number, number] | null {
	if (routeDestinations.length === 0) return null;

	const serverTime = Date.now() + timeOffset;

	// 1. Before takeoff
	if (serverTime < routeDestinations[0].departure) {
		const d = routeDestinations[0];
		return [d.location.lng, d.location.lat];
	}

	// 2. After last stop
	const last = routeDestinations[routeDestinations.length - 1];
	if (serverTime > last.arrival) {
		return [last.location.lng, last.location.lat];
	}

	// 3. Find active segment
	for (let i = 0; i < routeDestinations.length - 1; i++) {
		const current = routeDestinations[i];
		const next = routeDestinations[i + 1];

		// Case A: At a stop (between arrival and departure of current)
		// Note: The first stop "departure" is takeoff.
		// For subsequent stops, we use arrival and departure.

		// Actually, simple logic:
		// If time is between current.departure and next.arrival -> Moving
		// If time is between next.arrival and next.departure -> At next stop

		if (serverTime >= current.departure && serverTime < next.arrival) {
			// MOVING between current and next
			const totalDuration = next.arrival - current.departure;
			const elapsed = serverTime - current.departure;
			const progress = elapsed / totalDuration;

			// Linear interpolation
			const lng = current.location.lng + (next.location.lng - current.location.lng) * progress;
			const lat = current.location.lat + (next.location.lat - current.location.lat) * progress;
			return [lng, lat];
		}

		if (serverTime >= next.arrival && serverTime < next.departure) {
			// STOPPED at next
			return [next.location.lng, next.location.lat];
		}
	}

	return null;
}

/**
 * Update Santa's marker on the map
 */
function updateSantaSource() {
	if (!currentMap) return;

	const pos = calculatePosition();
	if (!pos) return; // Should not happen if route is loaded

	const source = currentMap.getSource(SANTA_SOURCE_ID) as maplibregl.GeoJSONSource;
	if (source) {
		source.setData({
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature',
					geometry: {
						type: 'Point',
						coordinates: pos
					},
					properties: {
						name: 'Santa Claus'
					}
				}
			]
		});
	}
}

/**
 * Setup map layers
 */
function initializeSantaLayer(map: maplibregl.Map): void {
	if (!map.getSource(SANTA_SOURCE_ID)) {
		map.addSource(SANTA_SOURCE_ID, {
			type: 'geojson',
			data: { type: 'FeatureCollection', features: [] }
		});
	}

	if (!map.getLayer(SANTA_LAYER_ID)) {
		const santaImage = new Image();
		santaImage.src = '/icons/santa.svg';
		santaImage.onload = () => {
			if (!map.hasImage('santa-icon')) map.addImage('santa-icon', santaImage);

			map.addLayer({
				id: SANTA_LAYER_ID,
				type: 'symbol',
				source: SANTA_SOURCE_ID,
				layout: {
					'icon-image': 'santa-icon',
					'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.4, 10, 0.8],
					'icon-allow-overlap': true,
					'icon-ignore-placement': true,
					'text-field': '🎅 Santa',
					'text-font': ['Arimo-Bold'],
					'text-size': 14,
					'text-offset': [0, 1.5],
					'text-anchor': 'top'
				},
				paint: {
					'text-color': '#c41e3a',
					'text-halo-color': '#ffffff',
					'text-halo-width': 2
				}
			});
		};
	}
}

/**
 * Main loop: Initial fetch, then 1-second ticks for position updates
 */
export async function startSantaTracking(map: maplibregl.Map): Promise<void> {
	if (!isChristmasWindow()) {
		console.log('🎄 Not Christmas time yet - Santa tracking disabled');
		return;
	}

	console.log('🎅 Starting Santa Tracking Service...');
	currentMap = map;

	// 1. Setup Layer
	initializeSantaLayer(map);

	// 2. Fetch Data
	const success = await initializeData();
	if (!success) {
		console.log('🎅 Failed to initialize Santa data. Retrubing in 1 min...');
		setTimeout(() => startSantaTracking(map), 60000);
		return;
	}

	// 3. Start Animation Loop
	if (processingIntervalId) clearInterval(processingIntervalId);

	processingIntervalId = window.setInterval(() => {
		updateSantaSource();

		// Re-sync occasionally (every 5 mins)
		if (Date.now() - lastSyncTime > 5 * 60 * 1000) {
			initializeData();
			lastSyncTime = Date.now();
		}
	}, 1000); // Update every second for smooth movement
}

export function stopSantaTracking(): void {
	if (processingIntervalId) clearInterval(processingIntervalId);
	processingIntervalId = null;
	currentMap = null;
	routeDestinations = [];
}
