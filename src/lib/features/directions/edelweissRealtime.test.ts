import { describe, expect, it } from 'vitest';
import { eventDelayMinutes, formatRealtimeDelay } from './edelweiss';

describe('Edelweiss v2 OJP realtime event delays', () => {
	const TimetabledTime = '2026-11-19T18:00:00Z';

	it('shows positive late minutes after the transit clock', () => {
		expect(formatRealtimeDelay({ TimetabledTime, EstimatedTime: '2026-11-19T18:05:00Z' })).toBe('+5'');
	});
	it('shows explicit on-time predictions as +0, not missing', () => {
		expect(formatRealtimeDelay({ TimetabledTime, EstimatedTime: TimetabledTime })).toBe('+0'');
	});
	it('shows early departures with a negative sign', () => {
		expect(formatRealtimeDelay({ TimetabledTime, EstimatedTime: '2026-11-19T17:58:00Z' })).toBe('-2'');
	});
	it('prefers recorded provenance over an earlier prediction', () => {
		expect(eventDelayMinutes({
			TimetabledTime,
			EstimatedTime: '2026-11-19T18:04:00Z',
			RecordedAtTime: '2026-11-19T18:07:00Z'
		})).toBe(7);
	});
	it('does not infer delay without a scheduled reference', () => {
		expect(formatRealtimeDelay({ EstimatedTime: '2026-11-19T18:05:00Z' })).toBeNull();
		expect(formatRealtimeDelay({ TimetabledTime })).toBeNull();
	});
});
