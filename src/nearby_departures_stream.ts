export type UnixTimestamp = number;
export type ServiceDate = string;

export interface NearbyDeparturesV3Query {
	lat: number;
	lon: number;
	departure_time?: UnixTimestamp;
	radius?: number;
	limit_per_station?: number;
	limit_per_headsign?: number;
	skip_realtime?: boolean;
	rt_timeout_ms?: number;
}

export interface StopOutputV3 {
	gtfs_id: string;
	name: string;
	lat: number;
	lon: number;
	osm_station_id: number | null;
	timezone: string;
}

export interface NearbyDeparturesDebug {
	total_time_ms: number;
	db_connection_time_ms: number;
	stops_fetch_time_ms: number;
	etcd_connection_time_ms: number;
	pipeline_processing_time_ms: number;
}

export interface RouteInfoExport {
	short_name: string | null;
	long_name: string | null;
	agency_name: string | null;
	color: string | null;
	text_color: string | null;
	route_type: number;

	/*
	 * These are added or inspected by the frontend even though the Rust
	 * RouteInfoExport currently does not explicitly serialize agency_id.
	 */
	agency_id?: string;
}

export interface AgencyInfo {
	agency_name: string | null;
}

export interface LongDistanceDeparture {
	scheduled_departure: UnixTimestamp | null;
	realtime_departure: UnixTimestamp | null;
	scheduled_arrival: UnixTimestamp | null;
	realtime_arrival: UnixTimestamp | null;
	service_date: ServiceDate;
	headsign: string;
	platform: string | null;
	trip_id: string;
	trip_short_name: string | null;
	route_id: string;
	stop_id: string;
	agency_id: string;
	cancelled: boolean;
	delayed: boolean;
	chateau_id: string;
	last_stop: boolean;
	final_station_name: string | null;
}

export interface StationDepartureGroup {
	station_name: string;
	osm_station_id: number | null;
	distance_m: number;
	departures: LongDistanceDeparture[];
	lat: number;
	lon: number;
	timezone: string;
}

export interface LocalDeparture {
	trip_id: string;
	departure_schedule: UnixTimestamp | null;
	departure_realtime: UnixTimestamp | null;
	arrival_schedule: UnixTimestamp | null;
	arrival_realtime: UnixTimestamp | null;
	stop_id: string;
	stop_name: string | null;
	cancelled: boolean;
	platform: string | null;
	service_date: ServiceDate;
	last_stop: boolean;
}

export interface LocalDepartureRouteGroup {
	chateau_id: string;
	route_id: string;
	color: string | null;
	text_color: string | null;
	short_name: string | null;
	long_name: string | null;
	route_type: number;
	agency_name: string | null;
	headsigns: Record<string, LocalDeparture[]>;
	closest_distance: number;
}

export interface NearbyDeparturesV3Response {
	long_distance: StationDepartureGroup[];
	local: LocalDepartureRouteGroup[];
	routes: Record<string, Record<string, RouteInfoExport>>;
	stops: Record<string, Record<string, StopOutputV3>>;
	debug?: NearbyDeparturesDebug | null;
}

// Ramonda's priority and remaining frames have the same shape as Birch v3.
type NearbyMessage = {
	type?: string;
	request_id?: string;
	phase?: string;
	complete?: boolean;
	data?: unknown;
	message?: string;
};

function isSnapshot(data: unknown): data is NearbyDeparturesV3Response {
	if (!data || typeof data !== 'object') return false;
	const candidate = data as NearbyDeparturesV3Response;
	return Array.isArray(candidate.local) && Array.isArray(candidate.long_distance) &&
		!!candidate.routes && !!candidate.stops;
}

function mergeDepartures<T>(
	first: T[], second: T[], key: (item: T) => string, time: (item: T) => number | null
): T[] {
	return [...new Map([...first, ...second].map(item => [key(item), item])).values()]
		.sort((a, b) => (time(a) ?? Infinity) - (time(b) ?? Infinity));
}

function localKey(item: LocalDeparture): string {
	const scheduled = item.departure_schedule != null || item.arrival_schedule != null;
	return JSON.stringify([item.trip_id, item.service_date, item.stop_id,
		scheduled ? item.departure_schedule : item.departure_realtime,
		scheduled ? item.arrival_schedule : item.arrival_realtime]);
}

function stationKey(station: StationDepartureGroup): string {
	return JSON.stringify(station.osm_station_id != null
		? ['osm', station.osm_station_id]
		: ['station', station.station_name, station.lat, station.lon]);
}

function mergeTables<T>(
	first: Record<string, Record<string, T>>, second: Record<string, Record<string, T>>
): Record<string, Record<string, T>> {
	return Object.fromEntries([...new Set([...Object.keys(first), ...Object.keys(second)])]
		.map(feed => [feed, { ...first[feed], ...second[feed] }]));
}

export function mergeNearbyDepartures(
	first: NearbyDeparturesV3Response, second: NearbyDeparturesV3Response
): NearbyDeparturesV3Response {
	const routeKey = (route: LocalDepartureRouteGroup) =>
		JSON.stringify([route.chateau_id, route.route_id]);
	const routes = new Map(first.local.map(route => [routeKey(route), route]));
	for (const route of second.local) {
		const key = routeKey(route);
		const previous = routes.get(key);
		if (!previous) {
			routes.set(key, route);
			continue;
		}
		const headsigns = Object.fromEntries(
			[...new Set([...Object.keys(previous.headsigns), ...Object.keys(route.headsigns)])]
				.map(headsign => [headsign, mergeDepartures(
					previous.headsigns[headsign] ?? [], route.headsigns[headsign] ?? [],
					localKey, item => item.departure_realtime ?? item.departure_schedule
				)])
		);
		routes.set(key, { ...route, headsigns,
			closest_distance: Math.min(previous.closest_distance, route.closest_distance) });
	}

	const stations = new Map(first.long_distance.map(station => [stationKey(station), station]));
	for (const station of second.long_distance) {
		const key = stationKey(station);
		const previous = stations.get(key);
		stations.set(key, !previous ? station : {
			...station,
			distance_m: Math.min(previous.distance_m, station.distance_m),
			departures: mergeDepartures(previous.departures, station.departures,
				item => JSON.stringify([item.chateau_id, item.route_id, item.trip_id,
					item.service_date, item.stop_id, item.scheduled_departure, item.scheduled_arrival]),
				item => item.realtime_departure ?? item.scheduled_departure)
		});
	}
	return {
		long_distance: [...stations.values()].sort((a, b) => a.distance_m - b.distance_m),
		local: [...routes.values()].sort((a, b) => a.closest_distance - b.closest_distance),
		routes: mergeTables(first.routes, second.routes),
		stops: mergeTables(first.stops, second.stops),
		debug: second.debug ?? first.debug
	};
}

export class NearbyDepartureStreamState {
	private priority: NearbyDeparturesV3Response | undefined;
	private finished = false;

	constructor(private requestId: string, private publishPriority: boolean) {}

	accept(value: unknown): { data: NearbyDeparturesV3Response; complete: boolean } | null {
		if (this.finished || !value || typeof value !== 'object') return null;
		const message = value as NearbyMessage;
		// Older deployments may reject an unknown request type without a request ID.
		if (message.type === 'error' && message.request_id == null) {
			throw new Error(message.message ?? 'Nearby departures unavailable');
		}
		if (message.request_id !== this.requestId) return null;
		if (message.type === 'nearby_departures_error' || message.type === 'error') {
			throw new Error(message.message ?? 'Nearby departures failed');
		}
		if (message.type !== 'nearby_departures') return null;
		if (!isSnapshot(message.data)) throw new Error('Missing nearby departures payload');
		const data = message.data;
		switch (message.phase) {
			case 'priority':
				if (message.complete) throw new Error('Priority frame cannot finish the request');
				if (this.priority) return null;
				this.priority = data;
				return this.publishPriority ? { data, complete: false } : null;
			case 'remaining':
				if (!message.complete || !this.priority) throw new Error('Invalid remaining frame');
				this.finished = true;
				return { data: mergeNearbyDepartures(this.priority, data), complete: true };
			case 'full':
				if (!message.complete) throw new Error('Incomplete full frame');
				this.finished = true;
				return { data, complete: true };
			default:
				throw new Error('Unknown nearby departures phase');
		}
	}
}

const SOCKET_URL = 'wss://ramonda.catenarymaps.org/ws/';
const HTTP_URL = 'https://birch_nearby.catenarymaps.org/nearbydeparturesfromcoordsv3';
type Parse = (text: string) => Promise<unknown>;

function fetchNearbySocket(
	query: NearbyDeparturesV3Query, progressive: boolean, signal: AbortSignal,
	parse: Parse, onPriority: (data: NearbyDeparturesV3Response) => void
): Promise<NearbyDeparturesV3Response> {
	return new Promise((resolve, reject) => {
		if (signal.aborted) {
			reject(signal.reason);
			return;
		}
		const requestId = crypto.randomUUID();
		const state = new NearbyDepartureStreamState(requestId, progressive);
		// A separate, request-scoped socket leaves Ramonda trip subscriptions untouched.
		const socket = new WebSocket(SOCKET_URL);
		let settled = false;
		let queue = Promise.resolve();

		const finish = (error: unknown, data?: NearbyDeparturesV3Response) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			signal.removeEventListener('abort', abort);
			socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
			if (socket.readyState < WebSocket.CLOSING) socket.close();
			if (data) resolve(data);
			else reject(error);
		};
		const abort = () => finish(signal.reason);
		const timeout = setTimeout(() => finish(new Error('Nearby WebSocket timed out')), 45_000);
		signal.addEventListener('abort', abort, { once: true });
		socket.onopen = () => {
			try {
				socket.send(JSON.stringify({
					...query, type: 'nearby_departures', request_id: requestId, progressive
				}));
			} catch (error) {
				finish(error);
			}
		};
		socket.onmessage = event => {
			// Worker parsing is asynchronous; process frames in wire order.
			queue = queue.then(async () => {
				if (settled) return;
				if (typeof event.data !== 'string') throw new Error('Unexpected nearby binary frame');
				const message = await parse(event.data);
				if (settled) return;
				const snapshot = state.accept(message);
				if (snapshot?.complete) finish(null, snapshot.data);
				else if (snapshot) onPriority(snapshot.data);
			}).catch(error => finish(error));
		};
		socket.onerror = () => finish(new Error('Nearby WebSocket failed'));
		socket.onclose = () => {
			// The final message may still be deserialising when the close event arrives.
			void queue.then(() => finish(new Error('Nearby WebSocket closed before completion')));
		};
	});
}

export async function fetchNearbyDepartures(
	query: NearbyDeparturesV3Query, progressive: boolean, signal: AbortSignal,
	parse: Parse, onPriority: (data: NearbyDeparturesV3Response) => void
): Promise<NearbyDeparturesV3Response> {
	try {
		return await fetchNearbySocket(query, progressive, signal, parse, onPriority);
	} catch (error) {
		if (signal.aborted) throw signal.reason;
		console.warn('Nearby WebSocket failed; retrying HTTP', error);
	}
	const url = new URL(HTTP_URL);
	for (const [key, value] of Object.entries(query)) {
		if (value != null) url.searchParams.set(key, String(value));
	}
	const response = await fetch(url, { signal });
	if (!response.ok) throw new Error(`Nearby HTTP request failed: ${response.status}`);
	const data = await parse(await response.text());
	if (signal.aborted) throw signal.reason;
	if (!isSnapshot(data)) throw new Error('Invalid nearby HTTP response');
	return data;
}
