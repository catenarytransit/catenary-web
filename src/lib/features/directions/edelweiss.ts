import polyline from '@mapbox/polyline';
import { MTA_CHATEAU_ID, isSubwayRouteId } from '$root/utils/mta_subway_utils';
import { IDFM_CHATEAU_ID, isRatpRoute } from '$root/utils/ratp_utils';

export interface Coordinate {
	lat: number;
	lon: number;
}

export interface RoutePoint extends Coordinate {
	name: string;
	/** Stop platform information, when included by the routing backend. */
	platform?: string | null;
	platformCode?: string | null;
}

export interface EdelweissGeometry {
	points?: string;
	precision?: number;
	length?: number;
}

export interface EdelweissIntermediateStop extends Partial<RoutePoint> {
	name: string;
	arrival?: string | null;
	departure?: string | null;
	scheduledArrival?: string | null;
	scheduledDeparture?: string | null;
}

export interface EdelweissLeg {
	mode: string;
	duration?: number;
	startTime?: string;
	endTime?: string;
	routeColor?: string | null;
	routeShortName?: string | null;
	/** GTFS route type from Edelweiss, if metadata is present. */
	routeType?: number | null;
	routeLongName?: string | null;
	/** Original GTFS route ID, retained as a last-resort identifier. */
	routeTextColor?: string | null;
	routeId?: string | null;
	tripShortName?: string | null;
	/** The originating timetable's source chateau (supplied by Edelweiss). */
	chateau?: string | null;
	from?: RoutePoint | null;
	to?: RoutePoint | null;
	fromPlatform?: string | null;
	toPlatform?: string | null;
	intermediateStops?: EdelweissIntermediateStop[];
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

export type TransitIcon = 'bus' | 'metro' | 'train' | 'tram' | 'ferry' | null;

export type StreetMode = 'WALK' | 'BIKE';

export interface StreetRoutingSettings {
	/** Apply the selected access mode to both the first and last mile. */
	mode: StreetMode;
	/** Walking/running pace in seconds per kilometre. */
	walkingPaceSecondsPerKm: number;
	/** Cycling speed in kilometres per hour. */
	cyclingSpeedKmH: number;
}

export const DEFAULT_STREET_ROUTING_SETTINGS: Readonly<StreetRoutingSettings> = {
	mode: 'WALK',
	walkingPaceSecondsPerKm: 840,
	cyclingSpeedKmH: 15
};

/** Convert a walking/running pace to the SI units expected by Edelweiss. */
export function walkingPaceToMetersPerSecond(secondsPerKm: number): number {
	if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) throw new RangeError('Invalid walking pace');
	return 1000 / secondsPerKm;
}

/** Convert cycling speed from km/h to the SI units expected by Edelweiss. */
export function cyclingKmhToMetersPerSecond(kmPerHour: number): number {
	if (!Number.isFinite(kmPerHour) || kmPerHour <= 0) throw new RangeError('Invalid cycling speed');
	return kmPerHour / 3.6;
}

export function formatWalkingPace(secondsPerKm: number): string {
	const seconds = Math.round(secondsPerKm);
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} min/km`;
}

/** Keep the street budget explicit and matched to the selected mode. */
export function streetRoutingRequest(settings: StreetRoutingSettings) {
	const budget = settings.mode === 'BIKE' ? 1800 : 900;
	return {
		preTransitModes: [settings.mode],
		postTransitModes: [settings.mode],
		pedestrianSpeed: walkingPaceToMetersPerSecond(settings.walkingPaceSecondsPerKm),
		cyclingSpeed: cyclingKmhToMetersPerSecond(settings.cyclingSpeedKmH),
		maxPreTransitTime: budget,
		maxPostTransitTime: budget
	};
}


export interface ItinerarySegment {
	mode: string;
	color: string;
	walking: boolean;
	/** Walking between two transit legs is a silent transfer, not access/egress. */
	transfer: boolean;
	duration: number;
	routeName: string | null;
	textColor: string;
	badgeKind: 'standard' | 'mta' | 'ratp' | 'sbahn' | 'sbb';
	icon: TransitIcon;
	coordinates: [number, number][];
	/** Calculated from detailed OSR walking geometry; null if unavailable. */
	distanceMeters: number | null;
}

/** Presentation-only entry for the directions details list. Original itinerary legs stay untouched. */
export interface ItineraryDetailLeg {
	leg: EdelweissLeg;
	/** Index in the unmodified itinerary (also indexes its transit style segments). */
	sourceIndex: number;
	/** Sum of walking durations, excluding any unrecorded waiting between legs. */
	walkingSeconds: number | null;
	/** Sum of OSR walking geometry lengths; null if any path has no geometry. */
	walkingMeters: number | null;
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
	const startsWithWalk = !!firstLeg && isStreetLeg(firstLeg.mode);
	const defaultMarkers = [
		{ time: itinerary.startTime, transit: !startsWithWalk },
		{ time: itinerary.endTime, transit: !startsWithWalk }
	];
	if (!startsWithWalk) return defaultMarkers;

	const transitIndices = itinerary.legs.flatMap((leg, index) => isStreetLeg(leg.mode) ? [] : [index]);
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
	if (isStreetLeg(itinerary.legs[itinerary.legs.length - 1].mode)) add(itinerary.endTime, false);
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
		case 'FERRY':
		case 'SHIP':
			return 'ferry';
		default:
			return null;
	}
}

/** Prefer the explicit mode; fall back to GTFS type, including extended modes. */
export function legTransitIcon(leg: EdelweissLeg): TransitIcon {
	const icon = transitIcon(leg.mode);
	if (icon) return icon;
	const type = leg.routeType;
	if (type === 3 || (type != null && type >= 700 && type < 800)) return 'bus';
	if (type === 0 || (type != null && type >= 900 && type < 1000)) return 'tram';
	if (type === 1 || (type != null && type >= 400 && type < 500)) return 'metro';
	if (type === 4 || (type != null && type >= 1000 && type < 1100)) return 'ferry';
	if (type === 2 || (type != null && type >= 100 && type < 400)) return 'train';
	return null;
}

export function isValidPoint(p: Coordinate | null | undefined): p is Coordinate {
	return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lon) &&
		p.lat >= -90 && p.lat <= 90 && p.lon >= -180 && p.lon <= 180;
}

export function isWalkingLeg(mode: string): boolean {
	return ['WALK', 'FOOT', 'PEDESTRIAN'].includes(mode.toUpperCase());
}

/** Cycling and walking are street legs, not transit boardings. */
export function isStreetLeg(mode: string): boolean {
	return isWalkingLeg(mode) || mode.toUpperCase() === 'BIKE';
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
	return leg.routeShortName?.trim() || leg.routeLongName?.trim() || leg.tripShortName?.trim() || leg.routeId?.trim() || null;
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
	if (!isStreetLeg(leg.mode) || !leg.legGeometry?.points) return null;
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

/** The displayed timeline follows wall-clock leg times when provided, not equal-sized chunks. */
function legDurationSeconds(leg: EdelweissLeg): number {
	const start = Date.parse(leg.startTime ?? '');
	const end = Date.parse(leg.endTime ?? '');
	if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
		return Math.max(1, (end - start) / 1000);
	}
	return Math.max(1, Number.isFinite(leg.duration) ? leg.duration as number : 1);
}

export function itinerarySegments(itinerary: EdelweissItinerary): ItinerarySegment[] {
	const transitIndices = itinerary.legs.flatMap((leg, index) => isStreetLeg(leg.mode) ? [] : [index]);
	const firstTransit = transitIndices[0] ?? -1;
	const lastTransit = transitIndices.at(-1) ?? -1;
	return itinerary.legs.map((leg, index) => ({
		mode: leg.mode,
		walking: isStreetLeg(leg.mode),
		transfer: isWalkingLeg(leg.mode) && firstTransit >= 0 && index > firstTransit && index < lastTransit,
		color: isStreetLeg(leg.mode) ? '#64748b' : routeColor(leg.routeColor),
		routeName: routeLabel(leg),
		textColor: routeTextColor(leg.routeTextColor, routeColor(leg.routeColor)),
		badgeKind: routeBadgeKind(leg),
		icon: isStreetLeg(leg.mode) ? null : legTransitIcon(leg),
		duration: legDurationSeconds(leg),
		coordinates: legCoordinates(leg),
		distanceMeters: walkingLegDistanceMeters(leg)
	}));
}

/** Combine adjacent pedestrian legs for the detailed list only.
 * Keep the original first leg and its index: route reconstruction and MapLibre
 * still use the separate, unchanged API legs and their geometries.
 */
export function itineraryDetailLegs(itinerary: EdelweissItinerary): ItineraryDetailLeg[] {
	const displayed: ItineraryDetailLeg[] = [];
	for (const [sourceIndex, leg] of itinerary.legs.entries()) {
		if (!isStreetLeg(leg.mode)) {
			displayed.push({ leg, sourceIndex, walkingSeconds: null, walkingMeters: null });
			continue;
		}
		const start = Date.parse(leg.startTime ?? '');
		const end = Date.parse(leg.endTime ?? '');
		const seconds = typeof leg.duration === 'number' && Number.isFinite(leg.duration) && leg.duration >= 0
			? leg.duration
			: Number.isFinite(start) && Number.isFinite(end) && end >= start
				? (end - start) / 1000
				: null;
		const meters = walkingLegDistanceMeters(leg);
		const previous = displayed.at(-1);
		if (previous && isStreetLeg(previous.leg.mode) && previous.leg.mode.toUpperCase() === leg.mode.toUpperCase()) {
			previous.walkingSeconds = previous.walkingSeconds !== null && seconds !== null
				? previous.walkingSeconds + seconds : null;
			previous.walkingMeters = previous.walkingMeters !== null && meters !== null
				? previous.walkingMeters + meters : null;
		} else {
			displayed.push({ leg, sourceIndex, walkingSeconds: seconds, walkingMeters: meters });
		}
	}
	return displayed;
}

/** Collapse consecutive walking legs in the card, without modifying map leg geometries. */
export function itineraryDisplaySegments(itinerary: EdelweissItinerary): ItinerarySegment[] {
	const displayed: ItinerarySegment[] = [];
	for (const segment of itinerarySegments(itinerary)) {
		const previous = displayed.at(-1);
		if (segment.walking && previous?.walking && segment.mode.toUpperCase() === previous.mode.toUpperCase() && segment.transfer === previous.transfer) {
			previous.duration += segment.duration;
			previous.distanceMeters = previous.distanceMeters !== null && segment.distanceMeters !== null
				? previous.distanceMeters + segment.distanceMeters : null;
			// This display-only geometry is not used to draw the MapLibre route.
			continue;
		}
		displayed.push({ ...segment });
	}
	// Preview-only filters: a transfer walk appears only when it exceeds
	// five minutes. Access/egress walks shorter than 25 m can be omitted when
	// detailed walking geometry provides a reliable distance. Unknown distances
	// stay visible rather than being silently treated as short walks.
	const hasTransit = displayed.some(segment => !segment.walking);
	return displayed.filter(segment => {
		if (!segment.walking) return true;
		if (segment.transfer) return segment.duration > 5 * 60;
		if (hasTransit && segment.distanceMeters !== null &&
			Number.isFinite(segment.distanceMeters) && segment.distanceMeters < 25) return false;
		return true;
	});
}

/**
 * Allocate the full available timeline width by elapsed leg duration, reserving
 * a few pixels for very short legs. The minimum is reduced on narrow cards or
 * many-leg trips, so the combined widths never exceed the container.
 */
export function allocateTimelinePercentages(
	segments: ReadonlyArray<Pick<ItinerarySegment, 'duration'>>,
	containerWidth: number,
	minimumWidth = 26
): number[] {
	const count = segments.length;
	if (!count) return [];
	const width = Number.isFinite(containerWidth) && containerWidth > 0 ? containerWidth : 320;
	const minPixels = Math.min(Math.max(0, minimumWidth), width / count);
	const weights = segments.map(s => Number.isFinite(s.duration) && s.duration > 0 ? s.duration : 1);
	const pixels = new Array<number>(count).fill(0);
	const remaining = new Set<number>(weights.map((_, i) => i));
	let remainingWidth = width;
	while (remaining.size) {
		const totalWeight = [...remaining].reduce((sum, i) => sum + weights[i], 0);
		const underMinimum = [...remaining].filter(i => remainingWidth * weights[i] / totalWeight < minPixels - 1e-9);
		if (!underMinimum.length) {
			for (const i of remaining) pixels[i] = remainingWidth * weights[i] / totalWeight;
			break;
		}
		for (const i of underMinimum) {
			pixels[i] = minPixels;
			remaining.delete(i);
			remainingWidth -= minPixels;
		}
	}
	const widths = pixels.map(p => p / width * 100);
	// Assign any floating-point rounding residue to the last segment.
	widths[count - 1] = Math.max(0, 100 - widths.slice(0, -1).reduce((sum, value) => sum + value, 0));
	return widths;
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
	// Edelweiss owns journey Pareto selection and search-direction ordering.
	// Do not mix direct routes into its transit itinerary ordering.
	// The backend's transit list comes first; direct alternatives follow,
	// preserving each collection's original order.
	return source.filter((item): item is EdelweissItinerary =>
		!!item && typeof item.startTime === 'string' &&
		typeof item.endTime === 'string' &&
		!Number.isNaN(Date.parse(item.startTime)) &&
		!Number.isNaN(Date.parse(item.endTime)) && Array.isArray(item.legs));
}

export async function queryEdelweiss(
	origin: Coordinate,
	destination: Coordinate,
	timeUnixSeconds: number,
	signal: AbortSignal,
	arriveBy = false,
	streetSettings: StreetRoutingSettings = DEFAULT_STREET_ROUTING_SETTINGS
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
			...(arriveBy ? { arrival_unix_seconds: Math.floor(timeUnixSeconds) } : { departure_unix_seconds: Math.floor(timeUnixSeconds) }),
			...streetRoutingRequest(streetSettings),
			detailed_legs: true
		}),
		signal
	});
	if (!response.ok) {
		const reason = (await response.text()).slice(0, 240);
		if (arriveBy && /missing field.*departure_unix_seconds|departure_unix_seconds.*required/i.test(reason)) {
			throw new Error('Arrive by routing requires the updated Edelweiss server.');
		}
		throw new Error(reason || 'Edelweiss returned HTTP ' + response.status);
	}
	return normalizePlan(await response.json());
}

/** Use a fresh timestamp for "Now" rather than reusing the timestamp when the planner opened. */
export function resolveDepartureUnixSeconds(
	selectedUnixSeconds: number,
	isNow: boolean,
	nowUnixSeconds: number = Date.now() / 1000
): number {
	const requested = isNow ? nowUnixSeconds : selectedUnixSeconds;
	return Math.floor(Number.isFinite(requested) && requested > 0 ? requested : nowUnixSeconds);
}

export function formatJourneyTime(iso: string): string {
	return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: false })
		.format(new Date(iso));
}
