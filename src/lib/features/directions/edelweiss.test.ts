import { describe, expect, it } from 'vitest';
import polyline from '@mapbox/polyline';
import { itinerarySegments, itineraryTimeMarkers, legCoordinates, normalizePlan, routeColor, transitIcon, type EdelweissItinerary } from './edelweiss';
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
	it('chooses the correct SBB pictogram for common transit modes', () => {
		expect(transitIcon('BUS')).toBe('bus');
		expect(transitIcon('SUBWAY')).toBe('metro');
		expect(transitIcon('TRAM')).toBe('tram');
		expect(transitIcon('RAIL')).toBe('train');
		expect(transitIcon('FERRY')).toBeNull();
		const named = itinerarySegments({...itinerary, legs: [
			{mode: 'BUS', routeShortName: '720', routeColor: '123456'}
		]});
		expect(named[0].routeName).toBe('720');
		expect(named[0].icon).toBe('bus');
	});
	it('renders walking start, transit start/end and walking end as four timestamps', () => {
		const timed: EdelweissItinerary = {
			startTime: '2026-10-23T17:00:00Z', endTime: '2026-10-23T17:30:00Z',
			legs: [
				{mode:'WALK', endTime:'2026-10-23T17:05:00Z'},
				{mode:'BUS', startTime:'2026-10-23T17:05:00Z', endTime:'2026-10-23T17:25:00Z'},
				{mode:'WALK', startTime:'2026-10-23T17:25:00Z'}
			]
		};
		expect(itineraryTimeMarkers(timed)).toEqual([
			{time:'2026-10-23T17:00:00Z',transit:false},
			{time:'2026-10-23T17:05:00Z',transit:true},
			{time:'2026-10-23T17:25:00Z',transit:true},
			{time:'2026-10-23T17:30:00Z',transit:false}
		]);
		expect(itineraryTimeMarkers({...timed,legs:timed.legs.slice(0,2)})).toHaveLength(3);
		expect(itineraryTimeMarkers({...timed,legs:timed.legs.slice(1)})).toEqual([
			{time:timed.startTime, transit:true}, {time:timed.endTime, transit:true}
		]);
		expect(itineraryTimeMarkers({...timed,legs:[timed.legs[0]]})).toEqual([
			{time:timed.startTime, transit:false}, {time:timed.endTime, transit:false}
		]);
	});
	it('does not invent unknown boarding times', () => {
		const times = itineraryTimeMarkers({...itinerary, legs: [
			{mode:'WALK'}, {mode:'BUS', endTime:'2026-10-23T17:25:00Z'}, {mode:'WALK'}
		]});
		expect(times).toEqual([
			{time:itinerary.startTime, transit:false},
			{time:'2026-10-23T17:25:00Z', transit:true},
			{time:itinerary.endTime, transit:false}
		]);
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
