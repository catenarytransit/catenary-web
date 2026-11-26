import { describe, expect, it } from 'vitest';
import { mergeNearbyDepartures, NearbyDepartureStreamState } from './nearby_departures_stream';
import type {
	LocalDeparture, LocalDepartureRouteGroup, NearbyDeparturesV3Response,
	RouteInfoExport, StationDepartureGroup, LongDistanceDeparture, StopOutputV3
} from './nearby_departures_stream';

const empty = (): NearbyDeparturesV3Response => ({
	long_distance: [], local: [], routes: {}, stops: {}
});
const trip = (time: number, realtime: number | null = null): LocalDeparture => ({
	trip_id: 'trip', service_date: '20261125', stop_id: 'stop', stop_name: 'Stop',
	departure_schedule: time, arrival_schedule: time, departure_realtime: realtime,
	arrival_realtime: null, cancelled: false, platform: null, last_stop: false
});
const route = (feed: string, headsigns: Record<string, LocalDeparture[]>): LocalDepartureRouteGroup => ({
	chateau_id: feed, route_id: 'route', headsigns, closest_distance: 100,
	color: null, text_color: null, short_name: '1', long_name: null, route_type: 3, agency_name: null
});
const longTrip = (time: number, realtime: number | null = null): LongDistanceDeparture => ({
	chateau_id: 'rail', route_id: 'r', trip_id: 't', stop_id: 's', agency_id: 'a',
	service_date: '20261125', scheduled_departure: time, scheduled_arrival: time,
	realtime_departure: realtime, realtime_arrival: null, headsign: 'Rail', platform: null,
	trip_short_name: null, cancelled: false, delayed: false, last_stop: false, final_station_name: null
});
const station = (departures: LongDistanceDeparture[], distance_m = 100): StationDepartureGroup => ({
	osm_station_id: 123, station_name: 'Station', distance_m, lat: 34, lon: -118,
	timezone: 'America/Los_Angeles', departures
});
const frame = (phase: string, data: NearbyDeparturesV3Response, request_id = 'active') => ({
	type: 'nearby_departures', request_id, phase, complete: phase !== 'priority', data
});

describe('nearby departure phases', () => {
	it('merges directions, feed-scoped routes, loop visits, stations and both lookup tables', () => {
		const priority = {
			...empty(),
			local: [route('a', { North: [trip(100), trip(200)] })],
			long_distance: [station([longTrip(100), longTrip(200)])],
			routes: { a: { r1: {} as RouteInfoExport } },
			stops: { a: { s1: {} as StopOutputV3 } }
		};
		const remaining = {
			...empty(),
			local: [route('a', { North: [trip(100, 120)], South: [trip(300)] }), route('b', {})],
			long_distance: [station([longTrip(100, 130), longTrip(300)], 50)],
			routes: { a: { r2: {} as RouteInfoExport } },
			stops: { a: { s2: {} as StopOutputV3 }, b: { s3: {} as StopOutputV3 } }
		};
		const result = mergeNearbyDepartures(priority, remaining);
		expect(result.local).toHaveLength(2);
		expect(result.local[0].headsigns.North).toEqual([trip(100, 120), trip(200)]);
		expect(result.local[0].headsigns.South).toEqual([trip(300)]);
		expect(result.long_distance).toHaveLength(1);
		expect(result.long_distance[0].distance_m).toBe(50);
		expect(result.long_distance[0].departures).toEqual([longTrip(100, 130), longTrip(200), longTrip(300)]);
		expect(Object.keys(result.routes.a)).toEqual(['r1', 'r2']);
		expect(Object.keys(result.stops.a)).toEqual(['s1', 's2']);
		expect(result.stops.b.s3).toBeDefined();
	});

	it('publishes priority then merges remaining, ignoring stale and duplicate frames', () => {
		const priority = { ...empty(), local: [route('a', { North: [trip(100)] })] };
		const remaining = { ...empty(), local: [route('b', { South: [trip(200)] })] };
		const state = new NearbyDepartureStreamState('active', true);
		expect(state.accept(frame('priority', empty(), 'old'))).toBeNull();
		expect(state.accept(frame('priority', priority))).toEqual({ data: priority, complete: false });
		expect(state.accept(frame('priority', priority))).toBeNull();
		expect(state.accept(frame('remaining', remaining))?.data.local).toHaveLength(2);
		expect(state.accept(frame('full', empty()))).toBeNull();
	});

	it('does not publish partial refreshes, even if the server sends phases', () => {
		const state = new NearbyDepartureStreamState('active', false);
		expect(state.accept(frame('priority', empty()))).toBeNull();
		expect(state.accept(frame('remaining', empty()))?.complete).toBe(true);
	});

	it('replaces rather than merges when a full snapshot arrives', () => {
		const state = new NearbyDepartureStreamState('active', true);
		state.accept(frame('priority', { ...empty(), local: [route('a', {})] }));
		expect(state.accept(frame('full', empty()))).toEqual({ data: empty(), complete: true });
	});

	it('rejects incomplete, out-of-order and error responses so HTTP can retry', () => {
		expect(() => new NearbyDepartureStreamState('active', true)
			.accept(frame('remaining', empty()))).toThrow();
		expect(() => new NearbyDepartureStreamState('active', true)
			.accept({ ...frame('full', empty()), complete: false })).toThrow();
		expect(() => new NearbyDepartureStreamState('active', true)
			.accept({ type: 'nearby_departures_error', request_id: 'active', message: 'failed' })).toThrow('failed');
		expect(() => new NearbyDepartureStreamState('active', true)
			.accept({ type: 'error', message: 'unknown request' })).toThrow('unknown request');
	});
});
