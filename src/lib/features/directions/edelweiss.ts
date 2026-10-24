import polyline from '@mapbox/polyline';
import { MTA_CHATEAU_ID, isSubwayRouteId } from '$root/utils/mta_subway_utils';
import { IDFM_CHATEAU_ID, isRatpRoute } from '$root/utils/ratp_utils';

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
	routeTextColor?: string | null;
	routeId?: string | null;
	tripShortName?: string | null;
	/** The originating timetable's source chateau (supplied by Edelweiss). */
	chateau?: string | null;
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
	textColor: string;
	badgeKind: 'standard' | 'mta' | 'ratp' | 'sbahn' | 'sbb';
	icon: TransitIcon;
	coordinates: [number, number][];
	/** Calculated from detailed OSR walking geometry; null if unavailable. */
	distanceMeters: number | null;
}

export interface ItineraryTimeMarker {
	time: string;
	transit: boolean;
}

export type ItineraryTimeItem =
	| { kind: 'time'; time: string; transit: boolean }
	| { kind: 'duration'; text: string };

/** Position the total duration midway between first boarding and final alighting. */
export function itineraryTimeRow(itinerary: EdelweissItinerary): ItineraryTimeItem[] {
	const markers = itineraryTimeMarkers(itinerary);
	const firstTransit = markers.findIndex(marker => marker.transit);
	const lastTransit = markers.findLastIndex(marker => marker.transit);
	// Pure walking journeys have no transit anchors; center the duration between endpoints.
	const insertion = firstTransit >= 0 && lastTransit > firstTransit ? lastTransit : 1;
	const items: ItineraryTimeItem[] = markers.map(marker => ({kind:'time',...marker}));
	items.splice(Math.min(insertion,items.length),0,{kind:'duration',text:formatJourneyDuration(itinerary)});
	return items;
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

/** Apply special badges only when the source chateau confirms the network. */
export function routeBadgeKind(leg: EdelweissLeg): ItinerarySegment['badgeKind'] {
	const chateau = leg.chateau || '';
	const shortName = (leg.routeShortName || '').trim();
	const mode = leg.mode.toUpperCase();
	if (chateau === MTA_CHATEAU_ID && mode === 'SUBWAY' &&
		isSubwayRouteId(shortName) && isSubwayRouteId(leg.routeId || shortName)) return 'mta';
	if (chateau === IDFM_CHATEAU_ID && isRatpRoute(shortName) && (
		(mode === 'SUBWAY' && /^(?:[1-9]|1[0-9]|[37]bis|[37]b)$/i.test(shortName)) ||
		(mode === 'TRAM' && /^T\d+[A-Za-z]?$/i.test(shortName)) ||
		(mode === 'RAIL' && /^[A-EHJKLNPRUV]$/i.test(shortName))
	)) return 'ratp';
	if (['deutschland','vbb'].includes(chateau) && ['RAIL','TRAIN'].includes(mode) &&
		/^S\d+[A-Za-z]?$/i.test(shortName)) return 'sbahn';
	if (chateau === 'schweiz' && ['RAIL','TRAIN'].includes(mode) &&
		/^(?:IC|IR)(?:\d+)?$|^EC$/i.test(shortName)) return 'sbb';
	return 'standard';
}

export function routeLabel(leg: EdelweissLeg): string | null {
	// UK rail route names are often generic operator labels, not a useful train ID.
	if (leg.chateau === 'nationalrailuk' && ['RAIL','TRAIN'].includes(leg.mode.toUpperCase())) {
		return leg.tripShortName?.trim() || null;
	}
	return leg.routeShortName?.trim() || leg.routeLongName?.trim() || null;
}

/** Use GTFS text color when supplied; otherwise select contrast against route color. */
export function routeTextColor(raw: unknown, background: string): string {
	if (typeof raw === 'string' && /^(?:#?[0-9a-fA-F]{3}|#?[0-9a-fA-F]{6})$/.test(raw.trim())) {
		return '#' + raw.trim().replace(/^#/, '');
	}
	const hex = background.replace('#','');
	const full = hex.length === 3 ? hex.split('').map(v=>v+v).join('') : hex;
	const rgb = [0,2,4].map(i => parseInt(full.slice(i,i+2),16) / 255)
		.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
	const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
	return luminance > 0.179 ? '#111111' : '#ffffff';
}

/** Haversine length of actual detailed walking geometry. Point count is not distance. */
export function walkingLegDistanceMeters(leg: EdelweissLeg): number | null {
	if (!isWalkingLeg(leg.mode) || !leg.legGeometry?.points) return null;
	// Disable the straight-line fallback; no path means no reliable walking length.
	const points = legCoordinates({ ...leg, from: null, to: null });
	if (points.length < 2) return null;
	const radians = Math.PI / 180;
	let total = 0;
	for (let i = 1; i < points.length; i++) {
		const [lonA, latA] = points[i - 1];
		const [lonB, latB] = points[i];
		const dLat = (latB - latA) * radians;
		const dLon = (lonB - lonA) * radians;
		const a = Math.sin(dLat / 2) ** 2 +
			Math.cos(latA * radians) * Math.cos(latB * radians) * Math.sin(dLon / 2) ** 2;
		total += 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)));
	}
	return total;
}

export function itinerarySegments(itinerary: EdelweissItinerary): ItinerarySegment[] {
	return itinerary.legs.map((leg) => ({
		mode: leg.mode,
		walking: isWalkingLeg(leg.mode),
		color: isWalkingLeg(leg.mode) ? '#64748b' : routeColor(leg.routeColor),
		routeName: routeLabel(leg),
		textColor: routeTextColor(leg.routeTextColor, routeColor(leg.routeColor)),
		badgeKind: routeBadgeKind(leg),
		icon: isWalkingLeg(leg.mode) ? null : transitIcon(leg.mode),
		duration: Math.max(1, Number.isFinite(leg.duration) ? (leg.duration as number) : Math.max(1,
			(new Date(leg.endTime ?? '').getTime() - new Date(leg.startTime ?? '').getTime()) / 1000 || 1)),
		coordinates: legCoordinates(leg),
		distanceMeters: walkingLegDistanceMeters(leg)
	}));
}

/** Collapse consecutive walking legs in the card, without modifying map leg geometries. */
export function itineraryDisplaySegments(itinerary: EdelweissItinerary): ItinerarySegment[] {
	const displayed: ItinerarySegment[] = [];
	for (const segment of itinerarySegments(itinerary)) {
		const previous = displayed.at(-1);
		if (segment.walking && previous?.walking) {
			previous.duration += segment.duration;
			previous.distanceMeters = previous.distanceMeters !== null && segment.distanceMeters !== null
				? previous.distanceMeters + segment.distanceMeters : null;
			// This display-only geometry is not used to draw the MapLibre route.
			continue;
		}
		displayed.push({ ...segment });
	}
	return displayed;
}

export function formatWalkSegment(segment: ItinerarySegment): string {
	const minutes = Math.max(1, Math.round(segment.duration / 60));
	const distance = segment.distanceMeters;
	if (distance === null || !Number.isFinite(distance)) return `${minutes}'`;
	if (distance >= 1000) {
		const kilometers = Math.round(distance / 100) / 10;
		return `${minutes}' - ${kilometers}km`;
	}
	return `${minutes}' - ${Math.round(distance / 10) * 10}m`;
}

export function formatJourneyDuration(itinerary: EdelweissItinerary): string {
	const elapsed = (Date.parse(itinerary.endTime) - Date.parse(itinerary.startTime)) / 1000;
	const duration = Number.isFinite(itinerary.duration) && (itinerary.duration ?? 0) >= 0
		? itinerary.duration as number : elapsed;
	const minutes = Math.max(0, Math.round(Math.max(0, duration) / 60));
	const hours = Math.floor(minutes / 60);
	return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
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
