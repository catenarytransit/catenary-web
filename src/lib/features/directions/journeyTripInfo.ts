import { SingleTrip } from '$components/stackenum';
import type { EdelweissLeg } from './edelweiss';

export interface JourneyTripEndpoint {
	stopId: string;
	sequence?: number | null;
	/** Scheduled Unix seconds disambiguate repeated visits if sequences are unavailable. */
	time: number;
}
export interface JourneyTripSegment {
	from: JourneyTripEndpoint;
	to: JourneyTripEndpoint;
}

export function singleTripForLeg(leg: EdelweissLeg): SingleTrip | null {
	if (!leg.chateau || !leg.tripId || !leg.tripStartDate || !leg.from?.stopId || !leg.to?.stopId)
		return null;
	const fromTime = Date.parse(leg.startTime ?? '') / 1000;
	const toTime = Date.parse(leg.endTime ?? '') / 1000;
	if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) return null;
	return new SingleTrip(
		leg.chateau,
		leg.tripId,
		leg.routeId ?? null,
		leg.tripStartTime ?? null,
		leg.tripStartDate,
		null,
		leg.routeType ?? null,
		{
			from: { stopId: leg.from.stopId, sequence: leg.fromStopSequence, time: fromTime },
			to: { stopId: leg.to.stopId, sequence: leg.toStopSequence, time: toTime }
		}
	);
}

interface TripStop {
	stop_id?: string;
	gtfs_stop_sequence?: number | null;
	scheduled_departure_time_unix_seconds?: number | null;
	scheduled_arrival_time_unix_seconds?: number | null;
	interpolated_stoptime_unix_seconds?: number | null;
}

export function resolveJourneySegment(
	stops: TripStop[],
	segment?: JourneyTripSegment | null
): { from: number; to: number } | null {
	if (!segment) return null;
	function find(endpoint: JourneyTripEndpoint, arrival: boolean): number {
		if (endpoint.sequence != null) {
			const exact = stops.findIndex(
				(stop) => stop.gtfs_stop_sequence === endpoint.sequence && stop.stop_id === endpoint.stopId
			);
			if (exact >= 0) return exact;
		}
		let best = -1,
			distance = Infinity;
		stops.forEach((stop, index) => {
			if (stop.stop_id !== endpoint.stopId) return;
			const time =
				(arrival
					? stop.scheduled_arrival_time_unix_seconds
					: stop.scheduled_departure_time_unix_seconds) ??
				stop.scheduled_departure_time_unix_seconds ??
				stop.scheduled_arrival_time_unix_seconds ??
				stop.interpolated_stoptime_unix_seconds;
			const delta = time == null ? Infinity : Math.abs(time - endpoint.time);
			if (delta < distance) {
				best = index;
				distance = delta;
			}
		});
		return best;
	}
	const from = find(segment.from, false),
		to = find(segment.to, true);
	return from >= 0 && to >= from ? { from, to } : null;
}

export function parseJourneyTripSegment(value: string | null): JourneyTripSegment | null {
	if (!value) return null;
	try {
		const data = JSON.parse(value);
		for (const endpoint of [data?.from, data?.to]) {
			if (
				!endpoint ||
				typeof endpoint.stopId !== 'string' ||
				!endpoint.stopId ||
				typeof endpoint.time !== 'number' ||
				!Number.isFinite(endpoint.time) ||
				(endpoint.sequence != null &&
					(!Number.isInteger(endpoint.sequence) || endpoint.sequence < 0))
			)
				return null;
		}
		return { from: data.from, to: data.to };
	} catch {
		return null;
	}
}
