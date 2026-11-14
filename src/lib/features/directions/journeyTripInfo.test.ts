import { describe, expect, it } from 'vitest';
import {
	parseJourneyTripSegment,
	resolveJourneySegment,
	singleTripForLeg
} from './journeyTripInfo';
import type { EdelweissLeg } from './edelweiss';

const leg: EdelweissLeg = {
	mode: 'BUS',
	chateau: 'test',
	tripId: 'loop',
	routeId: '1',
	routeType: 3,
	tripStartDate: '20261113',
	tripStartTime: '25:00:00',
	startTime: '2026-11-14T01:20:00Z',
	endTime: '2026-11-14T01:30:00Z',
	from: { stopId: 'A', name: 'A', lat: 0, lon: 0 },
	to: { stopId: 'A', name: 'A', lat: 0, lon: 0 },
	fromStopSequence: 30,
	toStopSequence: 50
};
const segment = singleTripForLeg(leg)!.journeySegment!;
const stops = [
	{
		stop_id: 'A',
		gtfs_stop_sequence: 10,
		scheduled_departure_time_unix_seconds: segment.from.time - 600
	},
	{ stop_id: 'B', gtfs_stop_sequence: 20 },
	{
		stop_id: 'A',
		gtfs_stop_sequence: 30,
		scheduled_departure_time_unix_seconds: segment.from.time
	},
	{ stop_id: 'B', gtfs_stop_sequence: 40 },
	{ stop_id: 'A', gtfs_stop_sequence: 50, scheduled_arrival_time_unix_seconds: segment.to.time },
	{ stop_id: 'C', gtfs_stop_sequence: 60 }
];
describe('journey trip info', () => {
	it('passes the service date and GTFS start time unchanged across midnight', () => {
		const trip = singleTripForLeg(leg)!;
		expect([trip.chateau_id, trip.trip_id, trip.start_date, trip.start_time]).toEqual([
			'test',
			'loop',
			'20261113',
			'25:00:00'
		]);
	});
	it('selects the intended visits to a repeated stop, inclusive of both endpoints', () => {
		expect(resolveJourneySegment(stops, segment)).toEqual({ from: 2, to: 4 });
	});
	it('falls back to scheduled times when stop sequences are unavailable', () => {
		expect(
			resolveJourneySegment(
				stops.map(({ gtfs_stop_sequence, ...stop }) => stop),
				segment
			)
		).toEqual({ from: 2, to: 4 });
	});
	it('does not highlight an unresolved or reversed section', () => {
		expect(resolveJourneySegment(stops, { from: segment.to, to: segment.from })).toBeNull();
		expect(
			resolveJourneySegment(stops, { from: { ...segment.from, stopId: 'missing' }, to: segment.to })
		).toBeNull();
		expect(resolveJourneySegment(stops)).toBeNull();
	});
	it('hides trip info when the backend cannot identify the trip instance', () => {
		expect(singleTripForLeg({ ...leg, tripStartDate: null })).toBeNull();
		expect(singleTripForLeg({ ...leg, tripId: null })).toBeNull();
	});
	it('round trips segment context through a shared URL and rejects invalid input', () => {
		expect(parseJourneyTripSegment(JSON.stringify(segment))).toEqual(segment);
		for (const value of ['no', 'null', '{}', '{"from":{"stopId":"A","time":0},"to":{}}'])
			expect(parseJourneyTripSegment(value)).toBeNull();
	});
});
