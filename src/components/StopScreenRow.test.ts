import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { addMessages, init } from 'svelte-i18n';
import StopScreenRow from './StopScreenRow.svelte';
import StationScreenTrainRow from './StationScreenTrainRow.svelte';
import StationScreenTrainRowCompact from './StationScreenTrainRowCompact.svelte';
import Clock from './Clock.svelte';
import { stopEventTimes } from '$lib/features/departures/eventTimes';

addMessages('en', { cancelled: 'Cancelled' });
init({ fallbackLocale: 'en', initialLocale: 'en' });
const arrivalOnly = {
	realtime_arrival: 1794709387,
	realtime_departure: null,
	scheduled_arrival: null,
	scheduled_departure: null,
	last_stop: false,
	unscheduled_trip: true,
	chateau: 'metro~losangeles',
	route_id: '801'
};
function row(component: any, event: any, extra = {}) {
	return render(component, {
		props: {
			event,
			timezone: 'America/Los_Angeles',
			current_time: 1794709300000,
			show_seconds: false,
			data_from_server: {},
			...extra
		}
	}).body;
}
describe.each([StopScreenRow, StationScreenTrainRow, StationScreenTrainRowCompact])(
	'stop event clocks',
	(component) => {
		it('renders realtime-only arrival in departure view without an invented schedule', () => {
			const html = row(component, arrivalOnly);
			expect(html).toContain('18:23');
			expect(html).not.toContain('16:00');
			expect(html).not.toContain('line-through');
			expect(html).not.toContain('NaN');
		});
		it('renders realtime departure when a terminal event has no arrival', () => {
			const html = row(
				component,
				{
					...arrivalOnly,
					last_stop: true,
					realtime_arrival: null,
					realtime_departure: arrivalOnly.realtime_arrival
				},
				{ show_arrivals: true }
			);
			expect(html).toContain('18:23');
			expect(html).not.toContain('16:00');
		});
		it('preserves cancellation status without inventing a scheduled time', () => {
			const html = row(component, { ...arrivalOnly, trip_cancelled: true });
			expect(html).toContain('Cancelled');
			expect(html).toContain('18:23');
			expect(html).not.toContain('16:00');
		});
	}
);
describe('compact nearby station departure times', () => {
	const scheduled = 1794709200;
	const departure = {
		...arrivalOnly,
		realtime_arrival: null,
		scheduled_departure: scheduled,
		realtime_departure: scheduled + 180,
		service_date: '2026-11-14',
		headsign: 'Central'
	};

	it('left-aligns equally sized scheduled and realtime clocks with a signed late delay', () => {
		const html = row(StationScreenTrainRowCompact, departure, {
			use_symbol_sign: true,
			show_timediff: false
		});
		expect(html).toContain('items-start justify-center text-left tabular-nums text-sm');
		expect(html).toContain('line-through text-sm');
		expect(html).toContain('font-medium text-sm');
		expect(html).toContain('18:20');
		expect(html).toContain('18:23');
		expect(html).toContain('>+</span>');
	});

	it('shows the platform as plain right-aligned text rather than a badge', () => {
		const html = row(StationScreenTrainRowCompact, departure, {
			platform: 'Platform 4A',
			show_timediff: false
		});
		expect(html).toContain('4A');
		expect(html).toContain('text-right w-[80px] align-middle');
		expect(html).not.toContain('bg-gray-200 dark:bg-gray-700');
		expect(html).not.toContain('px-1.5 py-0.5 rounded');
	});

	it('uses a minus sign for an early departure', () => {
		const html = row(
			StationScreenTrainRowCompact,
			{ ...departure, realtime_departure: scheduled - 180 },
			{ use_symbol_sign: true, show_timediff: false }
		);
		expect(html).toContain('>-</span>');
	});
});

describe('stop event time selection', () => {
	const both = {
		realtime_departure: 200,
		realtime_arrival: 180,
		scheduled_departure: 190,
		scheduled_arrival: 170
	};
	it('keeps departure and arrival preferences when both exist', () => {
		expect(stopEventTimes(both)).toEqual({ realtime: 200, scheduled: 190 });
		expect(stopEventTimes(both, true)).toEqual({ realtime: 180, scheduled: 170 });
	});
	it('does not compare arrival realtime to a departure schedule', () => {
		expect(stopEventTimes({ ...arrivalOnly, scheduled_departure: 1794709390 })).toEqual({
			realtime: 1794709387,
			scheduled: null
		});
	});
	it('falls back to available scheduled time without realtime', () => {
		expect(stopEventTimes({ scheduled_arrival: 100 })).toEqual({ realtime: null, scheduled: 100 });
		expect(stopEventTimes({ scheduled_departure: 100 }, true)).toEqual({
			realtime: null,
			scheduled: 100
		});
	});
	it.each([null, undefined, NaN])(
		'does not convert missing or invalid clock time %s to epoch',
		(time_seconds) => {
			const html = render(Clock, { props: { time_seconds, timezone: 'America/Los_Angeles' } }).body;
			expect(html).toContain('—');
			expect(html).not.toContain('16:00');
		}
	);
});
