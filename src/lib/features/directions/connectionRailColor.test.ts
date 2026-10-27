import { describe, expect, it } from 'vitest';
import { connectionRailColor } from './connectionRailColor';

describe('trip planner connection rail colours', () => {
	it('defaults to black in light mode and white in dark mode without a usable route colour', () => {
		expect(connectionRailColor(undefined, false)).toBe('#000000');
		expect(connectionRailColor(null, true)).toBe('#ffffff');
		expect(connectionRailColor('not a colour', false)).toBe('#000000');
	});

	it('uses route colours only when they contrast with the corresponding card', () => {
		expect(connectionRailColor('#b91c1c', false)).toBe('#b91c1c');
		expect(connectionRailColor('#b91c1c', true)).toBe('#ffffff');
		expect(connectionRailColor('#facc15', true)).toBe('#facc15');
		expect(connectionRailColor('#facc15', false)).toBe('#000000');
	});

	it('normalizes shorthand and unprefixed colours without losing readable fallbacks', () => {
		expect(connectionRailColor('000', false)).toBe('#000000');
		expect(connectionRailColor('fff', true)).toBe('#ffffff');
		expect(connectionRailColor('fff', false)).toBe('#000000');
		expect(connectionRailColor('000', true)).toBe('#ffffff');
	});
});
