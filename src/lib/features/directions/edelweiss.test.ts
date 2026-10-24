import { describe, expect, it } from 'vitest';
import polyline from '@mapbox/polyline';
import { itinerarySegments, itineraryDisplaySegments, itineraryTimeMarkers, itineraryTimeRow, formatWalkSegment, formatJourneyDuration, routeBadgeKind, routeLabel, legCoordinates, normalizePlan, routeColor, transitIcon, type EdelweissItinerary } from './edelweiss';
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
	it('combines consecutive walking legs for cards, not map geometry', () => {
		const merged = { ...itinerary, legs: [
			{mode:'WALK',duration:180}, {mode:'FOOT',duration:300},
			{mode:'RAIL',duration:600,routeShortName:'RE1'},
			{mode:'WALK',duration:120}, {mode:'WALK',duration:60}
		]};
		const display = itineraryDisplaySegments(merged);
		expect(display.map(x=>x.walking)).toEqual([true,false,true]);
		expect(display.map(x=>x.duration)).toEqual([480,600,180]);
		expect(itinerarySegments(merged)).toHaveLength(5);
		expect(formatWalkSegment(display[0])).toBe("8'");
	});
	it('sums real walking geometry length, and hides missing distances', () => {
		const path = polyline.encode([[0,0],[0,0.009]],6);
		const trip = {...itinerary,legs:[
			{mode:'WALK',duration:240,legGeometry:{points:path,precision:6}},
			{mode:'WALK',duration:240,legGeometry:{points:path,precision:6}}
		]};
		const walk = itineraryDisplaySegments(trip)[0];
		expect(walk.distanceMeters).toBeGreaterThan(1900);
		expect(formatWalkSegment(walk)).toBe("8' - 2km");
		const unavailable = itineraryDisplaySegments({...trip, legs:[trip.legs[0],{mode:'WALK',duration:240}]})[0];
		expect(formatWalkSegment(unavailable)).toBe("8'");
	});
	it('places total duration between first transit and last transit times', () => {
		const timed = {...itinerary, duration:30600, legs:[
			{mode:'WALK',endTime:'2026-10-23T17:05:00Z'},
			{mode:'RAIL',startTime:'2026-10-23T17:05:00Z',endTime:'2026-10-23T17:25:00Z'},
			{mode:'WALK'}
		]};
		expect(formatJourneyDuration(timed)).toBe('8 h 30 min');
		expect(itineraryTimeRow(timed).map(x=>x.kind)).toEqual(['time','time','duration','time','time']);
		expect(itineraryTimeRow({...timed,legs:timed.legs.slice(1)}).map(x=>x.kind))
			.toEqual(['time','duration','time']);
	});
	it('uses chateau to recognize MTA, RATP, and German S-Bahn badges', () => {
		expect(routeBadgeKind({mode:'SUBWAY',chateau:'nyct',routeId:'A',routeShortName:'A'})).toBe('mta');
		expect(routeBadgeKind({mode:'SUBWAY',chateau:'île~de~france~mobilités',routeShortName:'14'})).toBe('ratp');
		expect(routeBadgeKind({mode:'RAIL',chateau:'deutschland',routeShortName:'S8'})).toBe('sbahn');
		expect(routeBadgeKind({mode:'RAIL',chateau:'vbb',routeShortName:'S1'})).toBe('sbahn');
		expect(routeBadgeKind({mode:'RAIL',chateau:'schweiz',routeShortName:'IC5'})).toBe('sbb');
		expect(routeBadgeKind({mode:'SUBWAY',chateau:'other',routeShortName:'14'})).toBe('standard');
	});
	it('uses only trip short name for UK National Rail', () => {
		expect(routeLabel({mode:'RAIL',chateau:'nationalrailuk',routeShortName:'GWR',tripShortName:'1A23'})).toBe('1A23');
		expect(routeLabel({mode:'RAIL',chateau:'nationalrailuk',routeShortName:'GWR'})).toBeNull();
		expect(routeLabel({mode:'RAIL',chateau:'deutschland',routeShortName:'RE1',tripShortName:'6'})).toBe('RE1');
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
