import { describe, expect, it } from 'vitest';
import { getUnixTimeInTz, getZonedParts } from './datePickerTimezone';

function local(isoDate: string, timezone: string) {
	const [year, month, day, hour, minute] = isoDate.match(/\d+/g)!.map(Number);
	return getZonedParts(getUnixTimeInTz(year, month, day, hour, minute, timezone), timezone);
}

describe('date picker wall-clock timezone conversion', () => {
	it('keeps the same time across DST changes', () => {
		for (const date of ['2026-03-07T14:45', '2026-03-09T14:45', '2026-11-02T14:45']) {
			const p = local(date, 'America/Los_Angeles');
			expect([p.hour, p.minute]).toEqual([14, 45]);
			expect([p.year, p.month, p.day]).toEqual(date.slice(0, 10).split('-').map(Number));
		}
	});

	it('handles zones with fractional-hour offsets', () => {
		const p = local('2026-04-06T09:15', 'Asia/Kathmandu');
		expect([p.hour, p.minute]).toEqual([9, 15]);
	});

	it('moves forward through nonexistent times', () => {
		const p = local('2026-03-08T02:30', 'America/Los_Angeles');
		expect([p.year, p.month, p.day, p.hour, p.minute]).toEqual([2026, 3, 8, 3, 30]);
	});

	it('uses the earlier occurrence for ambiguous fall-back times', () => {
		const epoch = getUnixTimeInTz(2026, 11, 1, 1, 30, 'America/Los_Angeles');
		expect(new Date(epoch * 1000).toISOString()).toBe('2026-11-01T08:30:00.000Z');
	});

	it('supports the browser local timezone setting', () => {
		const p = local('2026-07-10T18:20', 'Local Time');
		expect([p.hour, p.minute]).toEqual([18, 20]);
	});

	it('keeps the date in UTC', () => {
		const p = local('2026-12-01T00:05', 'UTC');
		expect([p.year, p.month, p.day, p.hour, p.minute]).toEqual([2026, 12, 1, 0, 5]);
	});
});
