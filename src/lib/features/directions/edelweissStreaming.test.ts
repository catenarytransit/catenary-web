import { describe, it, expect } from 'vitest';
import {
	createRouteQuery, pageQuery, emptyEdelweissPage, mergeEdelweissPages,
	parseEdelweissPage, itineraryIdentity, INITIAL_RESULTS, ADDITIONAL_RESULTS
} from './edelweissStreaming';
import { DEFAULT_STREET_ROUTING_SETTINGS, type EdelweissItinerary } from './edelweiss';

const journey = (id: string, minute: number): EdelweissItinerary => ({
	id,
	startTime: `2026-11-09T12:${String(minute).padStart(2,'0')}:00Z`,
	endTime: `2026-11-09T13:${String(minute).padStart(2,'0')}:00Z`,
	legs: [{ mode: 'BUS', routeId: id }]
});

describe('Edelweiss stateless streaming pages', () => {
	it('keeps routing options and frozen timestamp across cursor requests', () => {
		const base = createRouteQuery(
			{lat: 33.64, lon: -117.84}, {lat: 34.05, lon: -118.24}, 1794201234,
			false, DEFAULT_STREET_ROUTING_SETTINGS
		);
		const initial = pageQuery(base, 'after');
		const later = pageQuery(base, 'after', 'opaque-cursor');
		const earlier = pageQuery(base, 'before', 'opaque-cursor-2');
		expect(initial).toMatchObject({
			departure_unix_seconds: 1794201234, timetable_view: true,
			detailed_legs: true, number_of_results_before: 0,
			number_of_results_after: INITIAL_RESULTS
		});
		expect(later).toMatchObject({
			page_cursor: 'opaque-cursor', number_of_results_before: 0,
			number_of_results_after: ADDITIONAL_RESULTS, preTransitModes: ['WALK']
		});
		expect(earlier).toMatchObject({
			page_cursor: 'opaque-cursor-2', number_of_results_before: ADDITIONAL_RESULTS,
			number_of_results_after: 0
		});
		expect(base).not.toHaveProperty('page_cursor');
		expect(pageQuery(createRouteQuery(
			{lat:33,lon:-117}, {lat:34,lon:-118}, 1794201234, true, DEFAULT_STREET_ROUTING_SETTINGS
		),'before')).toMatchObject({ arrival_unix_seconds: 1794201234, number_of_results_before: INITIAL_RESULTS });
	});

	it('replaces snapshots, sorts chronological connections, deduplicates IDs and keeps direct alternatives last', () => {
		const initial = parseEdelweissPage({
			itineraries: [journey('b', 20), journey('c', 30)],
			direct: [journey('walk', 0)],
			previousPageCursor: 'before', nextPageCursor: 'after'
		}, 'original');
		const earlier = parseEdelweissPage({
			itineraries: [journey('a', 10), journey('b', 20)],
			direct: [journey('walk', 0)],
			previousPageCursor: 'older', nextPageCursor: 'newer'
		}, 'page-1');
		const later = parseEdelweissPage({
			itineraries: [journey('d', 40)], direct: [],
			previousPageCursor: 'p', nextPageCursor: 'later'
		}, 'page-2');
		expect(mergeEdelweissPages([earlier, initial, later]).map(itineraryIdentity))
			.toEqual(['a','b','c','d','walk']);
		expect(mergeEdelweissPages([initial, later]).map(itineraryIdentity))
			.toEqual(['b','c','d','walk']);
		expect(earlier.previousPageCursor).toBe('older');
		expect(later.nextPageCursor).toBe('later');
	});

	it('handles empty pages and invalid payloads', () => {
		expect(mergeEdelweissPages([emptyEdelweissPage('test')])).toEqual([]);
		expect(parseEdelweissPage({itineraries: [], direct: []}, 'test').nextPageCursor).toBeNull();
		expect(() => parseEdelweissPage(null, 'test')).toThrow();
	});
});
