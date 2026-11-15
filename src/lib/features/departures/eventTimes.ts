interface StopEventTimes {
	realtime_arrival?: number | null;
	realtime_departure?: number | null;
	scheduled_arrival?: number | null;
	scheduled_departure?: number | null;
}

/** Prefer the requested event, but keep realtime-only trips visible in either view. */
export function stopEventTimes(event: StopEventTimes, showArrivals = false) {
	const kinds = showArrivals
		? (['arrival', 'departure'] as const)
		: (['departure', 'arrival'] as const);
	for (const kind of kinds) {
		const realtime = event[`realtime_${kind}`];
		if (realtime != null) {
			// Compare against the same event kind so dwell time does not become a delay.
			return { realtime, scheduled: event[`scheduled_${kind}`] ?? null };
		}
	}
	return {
		realtime: null,
		scheduled: event[`scheduled_${kinds[0]}`] ?? event[`scheduled_${kinds[1]}`] ?? null
	};
}
