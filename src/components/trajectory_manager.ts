import { get } from 'svelte/store';
import type { Map, GeoJSONSource } from 'maplibre-gl';
import { spruce_trajectory_data, subscribeTrajectories, unsubscribeTrajectories } from '../spruce_websocket';
import { determineDarkModeToBool } from './determineDarkModeToBool';
import { getContrastColours } from './processVehicleFeature';

let lastTrajectorySubTime = 0;
let lastTrajectorySubParams = '';
let interpolationInterval: any = null;
let wsUnsubscribe: (() => void) | null = null;
let activeTrajectoriesData: Record<string, { content: any[]; timestamp: number }> = {};
let pendingSourceData: Record<string, any> = {};

// Calculate bearing in degrees from [lon1, lat1] to [lon2, lat2]
function calculateBearing(lon1: number, lat1: number, lon2: number, lat2: number): number {
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const lat1Rad = (lat1 * Math.PI) / 180;
	const lat2Rad = (lat2 * Math.PI) / 180;

	const y = Math.sin(dLon) * Math.cos(lat2Rad);
	const x =
		Math.cos(lat1Rad) * Math.sin(lat2Rad) -
		Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

	const brng = Math.atan2(y, x);
	return ((brng * 180) / Math.PI + 360) % 360;
}

// Interpolate coordinates and calculate bearing along path based on progress fraction (0..1)
function interpolatePositionAndBearing(coordinates: number[][], progress: number) {
	if (coordinates.length === 0) return null;
	if (coordinates.length === 1) return { coords: coordinates[0], bearing: 0 };

	const segments: { length: number; start: number[]; end: number[] }[] = [];
	let totalLength = 0;

	for (let i = 0; i < coordinates.length - 1; i++) {
		const start = coordinates[i];
		const end = coordinates[i + 1];
		const dx = end[0] - start[0];
		const dy = end[1] - start[1];
		const length = Math.sqrt(dx * dx + dy * dy);
		segments.push({ length, start, end });
		totalLength += length;
	}

	if (totalLength === 0) {
		return { coords: coordinates[0], bearing: 0 };
	}

	const targetLength = progress * totalLength;
	let accumulatedLength = 0;

	for (const segment of segments) {
		if (accumulatedLength + segment.length >= targetLength) {
			const segmentProgress =
				segment.length > 0 ? (targetLength - accumulatedLength) / segment.length : 0;
			const lon = segment.start[0] + segmentProgress * (segment.end[0] - segment.start[0]);
			const lat = segment.start[1] + segmentProgress * (segment.end[1] - segment.start[1]);
			const bearing = calculateBearing(segment.start[0], segment.start[1], segment.end[0], segment.end[1]);
			return { coords: [lon, lat], bearing };
		}
		accumulatedLength += segment.length;
	}

	const lastSegment = segments[segments.length - 1];
	const bearing = calculateBearing(lastSegment.start[0], lastSegment.start[1], lastSegment.end[0], lastSegment.end[1]);
	return { coords: coordinates[coordinates.length - 1], bearing };
}

export function fetch_trajectories(layersettings: Record<string, any>, map: Map) {
	if (!map) return;
	const zoom = Math.round(map.getZoom());
	const bounds = map.getBounds();
	if (!bounds || typeof bounds.getWest !== 'function') {
		console.warn('[DEBUGTrajectories] Map bounds not available yet in fetch_trajectories');
		return;
	}
	const west = bounds.getWest();
	const south = bounds.getSouth();
	const east = bounds.getEast();
	const north = bounds.getNorth();
	if (isNaN(west) || isNaN(south) || isNaN(east) || isNaN(north)) {
		console.warn('[DEBUGTrajectories] Map bounds contain NaN values in fetch_trajectories');
		return;
	}
	const bbox = [west, south, east, north];

	const modes: string[] = [];

	// Don't fetch buses until zoom level >= 9 (follow minzoom 9 from addLiveDots)
	if (layersettings.bus?.visible && zoom >= 9) {
		modes.push('bus', 'trolleybus');
	}
	if (layersettings.intercityrail?.visible && zoom >= 3) {
		modes.push('rail');
	}
	if (layersettings.localrail?.visible && zoom >= 4) {
		modes.push('tram', 'subway', 'metro', 'funicular');
	}
	if (layersettings.other?.visible && zoom >= 3) {
		modes.push('ferry', 'cable_car', 'gondola', 'monorail');
	}

	if (modes.length === 0) {
		if (lastTrajectorySubParams !== '') {
			unsubscribeTrajectories();
			lastTrajectorySubParams = '';
		}
		return;
	}

	const params = {
		bbox,
		zoom,
		modes,
		client_reference: 'trajectories_layer'
	};

	const paramsStr = JSON.stringify(params);
	const now = Date.now();

	// Throttle sends to either when viewport/zoom/modes change, or every 15 seconds
	if (paramsStr !== lastTrajectorySubParams || now - lastTrajectorySubTime > 15000) {
		subscribeTrajectories(params);
		lastTrajectorySubParams = paramsStr;
		lastTrajectorySubTime = now;
	}
}

export function startTrajectoryManager(map: Map) {
	// Stop existing instances if any
	stopTrajectoryManager();

	// Subscribe to spruce trajectory websocket updates
	wsUnsubscribe = spruce_trajectory_data.subscribe((data) => {
		console.log('[DEBUGTrajectories] Received spruce_trajectory_data msg:', Object.keys(data).length, 'chateaus');
		if (data) {
			activeTrajectoriesData = data;
		}
	});

	// Run interpolation update loop every 1 second (1000ms)
	interpolationInterval = setInterval(() => {
		if (!map) return;

		const now = Date.now();
		const darkMode = determineDarkModeToBool();

		let activeCount = 0;
		for (const key in activeTrajectoriesData) {
			activeCount += activeTrajectoriesData[key].content?.length || 0;
		}

		const busesFeatures: any[] = [];
		const localrailFeatures: any[] = [];
		const intercityrailFeatures: any[] = [];
		const otherFeatures: any[] = [];

		for (const chateau in activeTrajectoriesData) {
			const activeTrajectories = activeTrajectoriesData[chateau].content;
			const timestamp = activeTrajectoriesData[chateau].timestamp;
			const offset = timestamp ? Date.now() - timestamp : 0;
			const clientNow = Date.now() - offset; // Use offset relative to each chateau

			for (const wrapper of activeTrajectories) {
				const traj = wrapper.content;
				if (!traj || !traj.stops || traj.stops.length === 0 || !traj.segments || traj.segments.length === 0) {
					continue;
				}

				const departureStr = traj.stops[0].departure;
				const arrivalStr = traj.stops[traj.stops.length - 1].arrival;
				const departure = new Date(departureStr).getTime();
				const arrival = new Date(arrivalStr).getTime();

				// Only show vehicle if current time is within trip duration bounds (with 30-second padding)
				if (clientNow < departure - 30000 || clientNow > arrival + 30000) {
					continue;
				}

				let coordinates: number[][] = [];
				for (const segment of traj.segments) {
					if (segment.coordinates) {
						coordinates = coordinates.concat(segment.coordinates);
					}
				}

				if (coordinates.length === 0) {
					continue;
				}

				// Clamp progress to [0, 1]
				const progress = Math.max(0, Math.min(1, (clientNow - departure) / (arrival - departure)));
				const interpolationResult = interpolatePositionAndBearing(coordinates, progress);
				if (!interpolationResult) continue;

				const { coords, bearing } = interpolationResult;
				const tripId = traj.trip_id || '';
				const uniqueTripId = traj.unique_trip_id || tripId;
				const displayName = traj.display_name || '';

				const rawColor = traj.color || '#aaaaaa';
				const { contrastdarkmode, contrastdarkmodebearing, contrastlightmode } = getContrastColours(
					rawColor,
					darkMode
				);

				let routeType = 3; // Default to bus
				if (traj.route_type !== undefined) {
					routeType = traj.route_type;
				} else {
					switch (traj.mode) {
						case 'tram':
						case 'cable_car':
						case 'funicular':
							routeType = 0;
							break;
						case 'subway':
						case 'metro':
							routeType = 1;
							break;
						case 'rail':
							routeType = 2;
							break;
						case 'bus':
						case 'trolleybus':
							routeType = 3;
							break;
						case 'ferry':
							routeType = 4;
							break;
						default:
							routeType = 3;
							break;
					}
				}

				const feature = {
					type: 'Feature' as const,
					id: `trajectory_${uniqueTripId}`,
					properties: {
						vehicleIdLabel: '',
						speed: '',
						color: rawColor,
						chateau: traj.chateau_id || '',
						route_type: routeType,
						tripIdLabel: displayName,
						bearing: bearing,
						has_bearing: true,
						maptag: displayName,
						trip_short_name: displayName,
						route_short_name: traj.route_short_name || displayName,
						route_long_name: traj.route_long_name || '',
						contrastdarkmode: contrastdarkmode,
						contrastdarkmodebearing: contrastdarkmodebearing,
						contrastlightmode: contrastlightmode,
						routeId: traj.route_id || '',
						headsign: traj.stops[traj.stops.length - 1].name || '',
						timestamp: now,
						text_color: traj.text_color || '#ffffff',
						trip_id: tripId,
						start_time: traj.start_time || departureStr,
						start_date: traj.start_date || '',
						crowd_symbol: '',
						occupancy_status: '',
						delay_label: '',
						delay: 0
					},
					geometry: {
						type: 'Point' as const,
						coordinates: coords
					}
				};

				// Group features into corresponding map sources
				if (routeType === 3 || routeType === 11) {
					busesFeatures.push(feature);
				} else if (routeType === 0 || routeType === 1 || routeType === 5 || routeType === 7) {
					localrailFeatures.push(feature);
				} else if (routeType === 2) {
					intercityrailFeatures.push(feature);
				} else {
					otherFeatures.push(feature);
				}
			}
		}

		// Update map GeoJSON sources
		const updateSource = (sourceName: string, features: any[]) => {
			const source = map.getSource(sourceName) as GeoJSONSource;
			if (source) {
				source.setData({
					type: 'FeatureCollection',
					features
				});
				delete pendingSourceData[sourceName];
			} else {
				pendingSourceData[sourceName] = {
					type: 'FeatureCollection',
					features
				};
			}
		};

		updateSource('trajectory_buses', busesFeatures);
		updateSource('trajectory_localrail', localrailFeatures);
		updateSource('trajectory_intercityrail', intercityrailFeatures);
		updateSource('trajectory_other', otherFeatures);
	}, 1000);
}

export function stopTrajectoryManager() {
	if (interpolationInterval) {
		clearInterval(interpolationInterval);
		interpolationInterval = null;
	}
	if (wsUnsubscribe) {
		wsUnsubscribe();
		wsUnsubscribe = null;
	}
	activeTrajectoriesData = {};
	lastTrajectorySubParams = '';
	pendingSourceData = {};
}

export function applyPendingSourceData(map: Map) {
	for (const sourceName in pendingSourceData) {
		const source = map.getSource(sourceName) as GeoJSONSource;
		if (source) {
			console.log(`[DEBUGTrajectories] Applying pending data for ${sourceName}`);
			source.setData(pendingSourceData[sourceName]);
			delete pendingSourceData[sourceName];
		}
	}
}
