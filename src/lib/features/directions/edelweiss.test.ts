import { describe, expect, it } from 'vitest';
import polyline from '@mapbox/polyline';
import {
    itinerarySegments,
    itineraryDetailLegs,
    itineraryDisplaySegments,
    allocateTimelinePercentages,
    itineraryTimeMarkers,
    itineraryTimeRow,
    formatWalkSegment,
    formatJourneyDuration,
    routeBadgeKind,
    legCoordinates,
    normalizePlan,
    routeColor,
    transitIcon,
    legTransitIcon,
    routeLabel,
    resolveDepartureUnixSeconds,
    queryEdelweiss,
    type EdelweissItinerary
} from './edelweiss';

import { itineraryGeoJson, itineraryStopGeoJson } from './mapRoutes';

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
	it('uses a fresh now timestamp or the exact selected departure time', () => {
		expect(resolveDepartureUnixSeconds(1_790_000_000, true, 1_800_000_010.9)).toBe(1_800_000_010);
		expect(resolveDepartureUnixSeconds(1_790_000_000.8, false, 1_800_000_010)).toBe(1_790_000_000);
	});

	it('sends an exclusive departure or arrival time field according to the mode', async () => {
		const calls: Record<string, unknown>[] = [];
		const oldFetch = globalThis.fetch;
		globalThis.fetch = (async (_url, init) => {
			calls.push(JSON.parse(String(init?.body)));
			return new Response(JSON.stringify({itineraries: [], direct: []}), {status: 200});
		}) as typeof fetch;
		try {
			const start = {lat:34,lon:-118};
			const end = {lat:34.1,lon:-118.1};
			const signal = new AbortController().signal;
			await queryEdelweiss(start, end, 1800000000, signal);
			await queryEdelweiss(start, end, 1800000001, signal, true);
			expect(calls[0]).toMatchObject({departure_unix_seconds:1800000000});
			expect(calls[0]).not.toHaveProperty('arrival_unix_seconds');
			expect(calls[1]).toMatchObject({arrival_unix_seconds:1800000001});
			expect(calls[1]).not.toHaveProperty('departure_unix_seconds');
		} finally { globalThis.fetch = oldFetch; }
	});

	it('shows only interchange points between transit legs', () => {
		expect(legTransitIcon({mode:'TRANSIT',routeType:3})).toBe('bus');
		expect(legTransitIcon({mode:'TRANSIT',routeType:2})).toBe('train');
		expect(routeLabel({mode:'BUS',routeId:'R42'})).toBe('R42');
		const journey: EdelweissItinerary = {...itinerary,legs:[
			{mode:'BUS',from:{lat:34,lon:-118,name:'Board'},to:{lat:34.1,lon:-118.1,name:'Transfer'}},
			{mode:'WALK',from:{lat:34.1,lon:-118.1,name:'Transfer'},to:{lat:34.2,lon:-118.2,name:'Transfer 2'}},
			{mode:'RAIL',from:{lat:34.2,lon:-118.2,name:'Transfer 2'},to:{lat:34.3,lon:-118.3,name:'Arrive'}}
		]};
		const stops = itineraryStopGeoJson(journey).features;
		expect(stops.map(stop=>stop.properties.kind)).toEqual(['transfer','transfer']);
		expect(stops.map(stop=>stop.geometry.coordinates)).toEqual([[-118.1,34.1],[-118.2,34.2]]);
		expect(itineraryStopGeoJson(undefined).features).toEqual([]);
		expect(itineraryStopGeoJson({...journey,legs:journey.legs.slice(0,1)}).features).toEqual([]);
	});
	it('deduplicates identical transfer coordinates and excludes invalid points', () => {
		const point = { lat: 34.1, lon: -118.1, name: 'Shared platform' };
		const journey: EdelweissItinerary = {
			startTime: itinerary.startTime, endTime: itinerary.endTime,
			legs: [
				{ mode: 'BUS', to: point },
				{ mode: 'WALK', from: point, to: point },
				{ mode: 'RAIL', from: point, to: { lat: NaN, lon: 0, name: 'Invalid' } },
				{ mode: 'BUS', from: { lat: NaN, lon: 0, name: 'Invalid' } }
			]
		};
		expect(itineraryStopGeoJson(journey).features.map(f => f.geometry.coordinates))
			.toEqual([[-118.1, 34.1]]);
	});
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
	it('groups consecutive walking legs only on the details screen', () => {
		const start = '2026-10-23T17:00:00Z';
		const journey: EdelweissItinerary = { startTime: start, endTime: '2026-10-23T17:30:00Z', legs: [
			{ mode: 'WALK', duration: 120, startTime: start, endTime: '2026-10-23T17:02:00Z',
				legGeometry: { points: polyline.encode([[34, -118], [34, -117.999]], 6), precision: 6 } },
			{ mode: 'FOOT', duration: 180, startTime: '2026-10-23T17:02:00Z', endTime: '2026-10-23T17:05:00Z',
				legGeometry: { points: polyline.encode([[34, -117.999], [34, -117.997]], 6), precision: 6 } },
			{ mode: 'BUS', duration: 900 },
			{ mode: 'WALK', duration: 75 },
			{ mode: 'WALK', duration: 45 }
		]};
		const details = itineraryDetailLegs(journey);
		expect(details.map(item => item.sourceIndex)).toEqual([0, 2, 3]);
		expect(details.map(item => item.leg.mode)).toEqual(['WALK', 'BUS', 'WALK']);
		expect(details[0].walkingSeconds).toBe(300);
		expect(details[0].walkingMeters).toBeGreaterThan(200);
		expect(details[2].walkingSeconds).toBe(120);
		expect(details[2].walkingMeters).toBeNull();
		expect(details[0].leg).toBe(journey.legs[0]);
		expect(journey.legs).toHaveLength(5);
		expect(itinerarySegments(journey)).toHaveLength(5);
	});
	it('does not invent walking duration or distance when a constituent value is missing', () => {
		const journey: EdelweissItinerary = { ...itinerary, legs: [
			{ mode: 'WALK', duration: 90 },
			{ mode: 'WALK' },
			{ mode: 'TRAIN', duration: 600 },
			{ mode: 'WALK', startTime: '2026-10-23T17:20:00Z', endTime: '2026-10-23T17:21:30Z' }
		]};
		const details = itineraryDetailLegs(journey);
		expect(details.map(item => item.sourceIndex)).toEqual([0, 2, 3]);
		expect(details[0].walkingSeconds).toBeNull();
		expect(details[0].walkingMeters).toBeNull();
		expect(details[2].walkingSeconds).toBe(90);
		expect(itineraryDetailLegs({ ...journey, legs: [] })).toEqual([]);
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
	it('marks internal walking transfers as silent segments and does not merge them with egress', () => {
		const trip: EdelweissItinerary = {
			startTime: itinerary.startTime, endTime: itinerary.endTime,
			legs: [
				{mode:'WALK', duration:60},
				{mode:'BUS', duration:600},
				{mode:'WALK', duration:45},
				{mode:'WALK', duration:75},
				{mode:'RAIL', duration:720},
				{mode:'WALK', duration:180}
			]
		};
		const segments = itineraryDisplaySegments(trip);
		expect(segments.map(x=>x.transfer)).toEqual([false,false,true,false,false]);
		expect(segments[2].walking).toBe(true);
		expect(segments[2].duration).toBe(120);
		expect(segments[4].duration).toBe(180);
	});
	it('fits proportional durations into exactly the available width with short-leg minimums', () => {
		const durations = [5, 5, 600, 20].map(duration=>({duration}));
		const widths = allocateTimelinePercentages(durations,300,26);
		expect(widths.reduce((a,b)=>a+b,0)).toBeCloseTo(100,8);
		expect(widths[0] * 3).toBeGreaterThanOrEqual(25.99);
		expect(widths[2]).toBeGreaterThan(widths[1]);
		const tiny = allocateTimelinePercentages(Array.from({length:20},()=>({duration:1})),70,26);
		expect(tiny.reduce((a,b)=>a+b,0)).toBeCloseTo(100,8);
		expect(tiny.every(w=>w>0)).toBe(true);
		expect(allocateTimelinePercentages([],300)).toEqual([]);
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
	it('preserves backend transit ordering and keeps direct journeys after transit', () => {
		const later = {...itinerary,startTime:'2026-10-23T18:00:00Z'};
		const earlier = {...itinerary,startTime:'2026-10-23T16:00:00Z'};
		const direct = {...itinerary,startTime:'2026-10-23T15:00:00Z'};
		const items = normalizePlan({itineraries:[later, earlier],direct:[direct]});
		expect(items).toHaveLength(3);
		expect(items.map(it => it.startTime)).toEqual([
			later.startTime, earlier.startTime, direct.startTime
		]);
	});
});
