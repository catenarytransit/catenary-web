import { describe, expect, it } from 'vitest';
import {
	departureRouteFilters,
	departureRouteMode,
	matchesDepartureRouteFilters,
	routeFiltersEnabled
} from './routeFilters';

const routes = {
	a: {
		one: { short_name: '2', color: '#abcdef', route_type: 3 },
		two: { short_name: '2', color: 'ABCDEF', route_type: 3 },
		ten: { short_name: '10', color: '#abcdef', route_type: 3 },
		red: { short_name: '2', color: '#ff0000', route_type: 3 },
		train: { short_name: 'R', route_type: 2 }
	},
	b: { one: { short_name: '2', color: '#abcdef', route_type: 3 } }
};

describe('departure route filters', () => {
	it('groups IDs by feed, displayed name and normalized color, and sorts naturally', () => {
		const filters = departureRouteFilters(routes, 'bus');
		expect(filters.map((filter) => filter.name)).toEqual(['2', '2', '2', '10']);
		expect(
			filters.find((filter) => filter.chateau === 'a' && filter.routeIds.has('one'))?.routeIds
		).toEqual(new Set(['one', 'two']));
		expect(departureRouteFilters(routes, 'rail').map((filter) => filter.name)).toEqual(['R']);
	});

	it('matches all grouped IDs, keeps feeds separate, and supports multiple selection and reset', () => {
		const filters = departureRouteFilters(routes, 'bus');
		const first = filters.find((filter) => filter.chateau === 'a' && filter.routeIds.has('one'))!;
		const ten = filters.find((filter) => filter.name === '10')!;
		const selected = new Set([first.key]);
		expect(matchesDepartureRouteFilters('a', 'one', selected, filters)).toBe(true);
		expect(matchesDepartureRouteFilters('a', 'two', selected, filters)).toBe(true);
		expect(matchesDepartureRouteFilters('b', 'one', selected, filters)).toBe(false);
		expect(matchesDepartureRouteFilters('a', 'ten', selected, filters)).toBe(false);
		selected.add(ten.key);
		expect(matchesDepartureRouteFilters('a', 'ten', selected, filters)).toBe(true);
		expect(matchesDepartureRouteFilters('b', 'one', new Set(), filters)).toBe(true);
	});

	it('falls back to long name or route ID for unnamed lines', () => {
		expect(
			departureRouteFilters(
				{ a: { x: { short_name: ' ', long_name: 'Express' }, y: {} } },
				'bus'
			).map((filter) => filter.name)
		).toEqual(['Express', 'y']);
	});

	it('excludes single-line tabs and existing rail filters, while permitting other modes at the same station', () => {
		const filters = departureRouteFilters(routes, 'bus');
		expect(routeFiltersEnabled(filters.slice(0, 1), 'bus', false, false)).toBe(false);
		expect(routeFiltersEnabled(filters, 'rail', true, false)).toBe(false);
		expect(routeFiltersEnabled(filters, 'rail', false, true)).toBe(false);
		expect(routeFiltersEnabled(filters, 'bus', true, true)).toBe(true);
		expect(routeFiltersEnabled(filters, 'rail', false, false)).toBe(true);
	});

	it('uses the Android mode groups including extended GTFS types', () => {
		expect([700, 900, 106, 4].map(departureRouteMode)).toEqual(['bus', 'metro', 'rail', 'other']);
	});
});
