import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import TripItineraryDetails from './TripItineraryDetails.svelte';
import JourneyPreviewTimeline from './JourneyPreviewTimeline.svelte';
import type { EdelweissLeg } from '$lib/features/directions/edelweiss';

const leg: EdelweissLeg = {
	mode: 'BUS',
	startTime: '2026-11-14T08:00:00Z',
	endTime: '2026-11-14T08:10:00Z',
	chateau: 'test',
	tripId: 'trip',
	tripStartDate: '20261114',
	tripStartTime: '00:00:00',
	from: { name: 'A', stopId: 'a', lat: 0, lon: 0 },
	to: { name: 'B', stopId: 'b', lat: 0, lon: 0 }
};
function details(connection: EdelweissLeg, expandedStops: Record<number, boolean> = {}) {
	return render(TripItineraryDetails, {
		props: {
			itinerary: { startTime: leg.startTime!, endTime: leg.endTime!, legs: [connection] },
			expandedStops,
			originName: 'A',
			destinationName: 'B',
			onBack: () => {}
		}
	}).body;
}
describe('trip info link', () => {
	it('renders even when there are no intermediate stops', () => {
		expect(details(leg)).toContain('Trip info');
		expect(details(leg)).toContain('chevron_right');
	});
	it('appears before the intermediate stop summary', () => {
		const html = details({ ...leg, intermediateStops: [{ name: 'Middle' }] });
		expect(html.indexOf('Trip info')).toBeLessThan(html.indexOf('1 stop'));
	});
	it('restores expanded intermediate stops from the planner session', () => {
		const connection = { ...leg, intermediateStops: [{ name: 'Restored middle stop' }] };
		expect(details(connection)).not.toContain('Restored middle stop');
		expect(details(connection, { 0: true })).toContain('Restored middle stop');
	});
	it('does not offer an unidentified trip', () => {
		expect(details({ ...leg, tripId: null })).not.toContain('Trip info');
	});
});

describe('realtime delay layout', () => {
	const realtimeLeg: EdelweissLeg = {
		...leg,
		ServiceDeparture: { TimetabledTime: leg.startTime, EstimatedTime: '2026-11-14T08:05:00Z' },
		ServiceArrival: { TimetabledTime: leg.endTime, EstimatedTime: leg.endTime },
		intermediateStops: [{
			name: 'Middle',
			departure: '2026-11-14T08:07:00Z',
			ServiceDeparture: {
				TimetabledTime: '2026-11-14T08:03:00Z',
				EstimatedTime: '2026-11-14T08:07:00Z'
			}
		}]
	};

	it('puts the departure delay at the right edge of the left summary group', () => {
		const html = render(JourneyPreviewTimeline, {
			props: { itinerary: { startTime: leg.startTime!, endTime: leg.endTime!, legs: [realtimeLeg] } }
		}).body;
		const departureGroup = html.match(/<div class="flex min-w-0 items-baseline justify-start[^"]*">([\s\S]*?)<\/div>/)?.[1] ?? '';
		expect(departureGroup).toMatch(/<time[^>]*>[\s\S]*?<\/time>[\s\S]*?data-testid="departure-delay"/);
		expect(departureGroup).toContain("+5'");
	});

	it('stacks departure, intermediate and arrival delays below right-aligned clock times', () => {
		const html = details(realtimeLeg, { 0: true });
		for (const kind of ['departure', 'intermediate', 'arrival']) {
			const stack = html.match(new RegExp('data-testid="' + kind + '-time-stack"[^>]*>([\\s\\S]*?)<\\/div>'))?.[1] ?? '';
			expect(stack).toMatch(/<time[^>]*>[\s\S]*?<\/time>[\s\S]*?<span/);
		}
		expect(html).toContain("+5'");
		expect(html).toContain("+4'");
		expect(html).toContain("+0'");
	});
});
