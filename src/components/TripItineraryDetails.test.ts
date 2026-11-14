import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import TripItineraryDetails from './TripItineraryDetails.svelte';
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
function details(connection: EdelweissLeg) {
	return render(TripItineraryDetails, {
		props: {
			itinerary: { startTime: leg.startTime!, endTime: leg.endTime!, legs: [connection] },
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
	it('does not offer an unidentified trip', () => {
		expect(details({ ...leg, tripId: null })).not.toContain('Trip info');
	});
});
