import polyline from '@mapbox/polyline';

export interface Coordinate {
	lat: number;
	lon: number;
}

export interface RoutePoint extends Coordinate {
	name: string;
}

export interface EdelweissGeometry {
	points?: string;
	precision?: number;
	length?: number;
}

export interface EdelweissLeg {
	mode: string;
	duration?: number;
	startTime?: string;
	endTime?: string;
	routeColor?: string | null;
	routeShortName?: string | null;
	routeLongName?: string | null;
	from?: RoutePoint | null;
	to?: RoutePoint | null;
	legGeometry?: EdelweissGeometry | null;
}

export interface EdelweissItinerary {
	startTime: string;
	endTime: string;
	duration?: number;
	transfers?: number;
	legs: EdelweissLeg[];
}

export interface EdelweissPlan {
	itineraries: EdelweissItinerary[];
	direct: EdelweissItinerary[];
}

export type TransitIcon = 'bus' | 'metro' | 'train' | 'tram' | null;

export interface ItinerarySegment {
	mode: string;
	color: string;
	walking: boolean;
	duration: number;
	routeName: string | null;
	icon: TransitIcon;
	coordinates: [number, number][];
}

export interface ItineraryTimeMarker {
	time: string;
	transit: boolean;
}

/** Show access/egress times only for journeys starting with a walk. */
export function itineraryTimeMarkers(itinerary: EdelweissItinerary): ItineraryTimeMarker[] {
	const firstLeg = itinerary.legs[0];
	const startsWithWalk = !!firstLeg && isWalkingLeg(firstLeg.mode);
	const defaultMarkers = [
		{ time: itinerary.startTime, transit: !startsWithWalk },
		{ time: itinerary.endTime, transit: !startsWithWalk }
	];
	if (!startsWithWalk) return defaultMarkers;

	const transitIndices = itinerary.legs.flatMap((leg, index) => isWalkingLeg(leg.mode) ? [] : [index]);
	if (!transitIndices.length) return defaultMarkers;
	const firstIndex = transitIndices[0];
	const lastIndex = transitIndices[transitIndices.length - 1];
	const transitStart = itinerary.legs[firstIndex].startTime ?? itinerary.legs[firstIndex - 1]?.endTime;
	const transitEnd = itinerary.legs[lastIndex].endTime ?? itinerary.legs[lastIndex + 1]?.startTime ??
		(lastIndex === itinerary.legs.length - 1 ? itinerary.endTime : undefined);
	const markers: ItineraryTimeMarker[] = [];
	function add(time: string | undefined, transit: boolean): void {
		if (!time || !Number.isFinite(Date.parse(time))) return;
		if (markers.at(-1)?.time === time) return;
		markers.push({ time, transit });
	}
	add(itinerary.startTime, false);
	add(transitStart, true);
	add(transitEnd, true);
	if (isWalkingLeg(itinerary.legs[itinerary.legs.length - 1].mode)) add(itinerary.endTime, false);
	return markers;
}

/** Use the SBB right-facing pictograms available in static/icons. */
export function transitIcon(mode: string): TransitIcon {
	switch (mode.toUpperCase()) {
		case 'BUS':
		case 'TROLLEYBUS':
		case 'COACH':
			return 'bus';
		case 'SUBWAY':
		case 'METRO':
		case 'UNDERGROUND':
			return 'metro';
		case 'TRAM':
		case 'STREETCAR':
		case 'LIGHT_RAIL':
		case 'LIGHTRAIL':
			return 'tram';
		case 'RAIL':
		case 'TRAIN':
		case 'HEAVY_RAIL':
		case 'COMMUTER_RAIL':
		case 'REGIONAL_RAIL':
		case 'INTERCITY_RAIL':
		case 'HIGH_SPEED_RAIL':
		case 'HIGHSPEED_RAIL':
			return 'train';
		default:
			return null;
	}
}

export function isValidPoint(p: Coordinate | null | undefined): p is Coordinate {
	return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lon) &&
		p.lat >= -90 && p.lat <= 90 && p.lon >= -180 && p.lon <= 180;
}

export function isWalkingLeg(mode: string): boolean {
	return ['WALK', 'FOOT', 'PEDESTRIAN'].includes(mode.toUpperCase());
}

export function routeColor(value: unknown): string {
	if (typeof value !== 'string') return '#087b8b';
	const hex = value.trim().replace(/^#/, '');
	return /^[0-9a-fA-F]{6}$/.test(hex) || /^[0-9a-fA-F]{3}$/.test(hex)
		? '#' + hex : '#087b8b';
}

export function legCoordinates(leg: EdelweissLeg): [number, number][] {
	const geometry = leg.legGeometry;
	if (geometry?.points && typeof geometry.points === 'string') {
		try {
			const points = polyline.decode(geometry.points, geometry.precision ?? 6);
			const coords: [number, number][] = points.map(([lat, lon]) => [lon, lat]);
			if (coords.length >= 2 && coords.every(([lon, lat]) => isValidPoint({ lat, lon }))) {
				return coords;
			}
		} catch {
			// Return only confirmed geometry; never draw an invented transit alignment.
		}
	}
	// Straight access/egress connectors are acceptable only for walking where
	// OSR could not return a detailed shape; transit would misrepresent the route.
	if (isWalkingLeg(leg.mode) && isValidPoint(leg.from) && isValidPoint(leg.to)) {
		return [[leg.from.lon, leg.from.lat], [leg.to.lon, leg.to.lat]];
	}
	return [];
}

export function itinerarySegments(itinerary: EdelweissItinerary): ItinerarySegment[] {
	return itinerary.legs.map((leg) => ({
		mode: leg.mode,
		walking: isWalkingLeg(leg.mode),
		color: isWalkingLeg(leg.mode) ? '#64748b' : routeColor(leg.routeColor),
		routeName: leg.routeShortName?.trim() || leg.routeLongName?.trim() || null,
		icon: isWalkingLeg(leg.mode) ? null : transitIcon(leg.mode),
		duration: Math.max(1, Number.isFinite(leg.duration) ? (leg.duration as number) : Math.max(1,
			(new Date(leg.endTime ?? '').getTime() - new Date(leg.startTime ?? '').getTime()) / 1000 || 1)),
		coordinates: legCoordinates(leg)
	}));
}

export function normalizePlan(value: unknown): EdelweissItinerary[] {
	if (!value || typeof value !== 'object') throw new Error('Edelweiss returned invalid data');
	const plan = value as Partial<EdelweissPlan>;
	const source = [
		...(Array.isArray(plan.itineraries) ? plan.itineraries : []),
		...(Array.isArray(plan.direct) ? plan.direct : [])
	];
	return source.filter((item): item is EdelweissItinerary =>
		!!item && typeof item.startTime === 'string' &&
		typeof item.endTime === 'string' &&
		!Number.isNaN(Date.parse(item.startTime)) &&
		!Number.isNaN(Date.parse(item.endTime)) && Array.isArray(item.legs))
		.sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
}

export async function queryEdelweiss(
	origin: Coordinate,
	destination: Coordinate,
	departureUnixSeconds: number,
	signal: AbortSignal
): Promise<EdelweissItinerary[]> {
	if (!isValidPoint(origin) || !isValidPoint(destination)) {
		throw new Error('Select valid starting and finishing locations');
	}
	const response = await fetch('https://edelweiss.catenarymaps.org/v1/route', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			from: { lat: origin.lat, lon: origin.lon },
			to: { lat: destination.lat, lon: destination.lon },
			departure_unix_seconds: Math.floor(departureUnixSeconds),
			detailed_legs: true
		}),
		signal
	});
	if (!response.ok) {
		const reason = (await response.text()).slice(0, 240);
		throw new Error(reason || 'Edelweiss returned HTTP ' + response.status);
	}
	return normalizePlan(await response.json());
}

export function formatJourneyTime(iso: string): string {
	return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: false })
		.format(new Date(iso));
}
