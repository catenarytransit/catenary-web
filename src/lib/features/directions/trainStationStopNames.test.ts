import { describe, expect, it } from 'vitest';
import { displayTrainStationStopName, shouldShortenTrainStationStops } from './trainStationStopNames';

describe('rail trip stop labels', () => {
	it('removes the whole-word suffix when every stop on a tram, metro or rail trip qualifies', () => {
		for (const type of [0, 1, 2]) {
			expect(shouldShortenTrainStationStops(type, ['Central Station', 'Union Station'])).toBe(true);
		}
		expect(displayTrainStationStopName('Central STATION  ', true)).toBe('Central');
	});
	it('preserves mixed names, missing stops and non-rail routes', () => {
		expect(shouldShortenTrainStationStops(2, ['Central Station', 'Town Hall'])).toBe(false);
		expect(shouldShortenTrainStationStops(3, ['Central Station', 'Union Station'])).toBe(false);
		expect(shouldShortenTrainStationStops(null, ['Central Station'])).toBe(false);
		expect(shouldShortenTrainStationStops(2, ['Central Station', null])).toBe(false);
		expect(shouldShortenTrainStationStops(2, [])).toBe(false);
		expect(displayTrainStationStopName('Central Station', false)).toBe('Central Station');
	});
	it('requires a distinct terminal word and retains a standalone Station', () => {
		for (const name of ['Station', 'Substation', 'Station Road']) {
			expect(shouldShortenTrainStationStops(2, ['Union Station', name])).toBe(false);
		}
	});
});
