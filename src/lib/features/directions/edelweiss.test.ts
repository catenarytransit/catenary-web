import { describe, expect, it } from 'vitest';
import polyline from '@mapbox/polyline';
import { itinerarySegments, legCoordinates, normalizePlan, routeColor, type EdelweissItinerary } from './edelweiss';
import { itineraryGeoJson } from './mapRoutes';

const itinerary: EdelweissItinerary = {
	startTime: '2026-10-23T17:00:00Z',
	endTime: '2026-10-23T17:30:00Z',
	duration: 1800,
	legs: [
		{ mode:'WALK', duration:300, from:{lat:34,lon:-118,name:'From'},to:{lat:34.01,lon:-118.01,name:'Stop'} },
		{ mode:'BUS', duration:1200, routeColor:'FF0000',
			legGeometry:{points:polyline.encode([[34.01,-118.01],[34.02,-118.02],[34.03,-118.03]],6),precision:6,length:3} },
		{ mode:'WALK', duration:300, from:{lat:34.03,lon:-118.03,name:'Stop'},to:{lat:34.04,lon:-118.04,name:'To'} }
	]
};
describe('Edelweiss geometry and itinerary presentation', () => {
	it('decodes MOTIS six-digit leg geometry in lon-lat order', () => {
		expect(legCoordinates(itinerary.legs[1])).toEqual([[-118.01,34.01],[-118.02,34.02],[-118.03,34.03]]);
	});
	it('colors transit legs and marks walking legs as dotted', () => {
		const segments = itinerarySegments(itinerary);
		expect(segments.map(s=>s.walking)).toEqual([true,false,true]);
		expect(segments[1].color).toBe('#FF0000');
		const geo = itineraryGeoJson([itinerary],0);
		expect(geo.features).toHaveLength(3);
		expect(geo.features[1].geometry.coordinates).toHaveLength(3);
		expect(geo.features.every(f=>f.properties.active)).toBe(true);
	});
	it('does not invent straight transit alignments when geometry is missing', () => {
		expect(legCoordinates({mode:'RAIL',from:{lat:34,lon:-118,name:'A'},to:{lat:35,lon:-117,name:'B'}})).toEqual([]);
	});
	it('rejects invalid CSS colors from upstream', () => {
		expect(routeColor('red; background:url(x)')).toBe('#087b8b');
	});
	it('keeps both direct and transit itineraries in departure order', () => {
		const items = normalizePlan({itineraries:[itinerary],direct:[{...itinerary,startTime:'2026-10-23T16:00:00Z'}]});
		expect(items).toHaveLength(2);
		expect(items[0].startTime).toBe('2026-10-23T16:00:00Z');
	});
});
