/**
 * Convert a wall-clock date/time in an IANA time zone to a Unix timestamp.
 *
 * Date-only edits must preserve the displayed hour and minute, including when
 * the destination date uses a different UTC offset.
 */
export function getZonedParts(epochSeconds: number, timezone: string) {
	const options: Intl.DateTimeFormatOptions = {
		timeZone: timezone === 'Local Time' || !timezone ? undefined : timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23'
	};
	const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(
		new Date(epochSeconds * 1000)
	);
	const values: Record<string, number> = {};
	for (const part of parts) {
		if (['year', 'month', 'day', 'hour', 'minute', 'second'].includes(part.type)) {
			values[part.type] = Number(part.value);
		}
	}
	return {
		year: values.year,
		month: values.month,
		day: values.day,
		hour: values.hour,
		minute: values.minute,
		second: values.second
	};
}

function wallTimestamp(parts: ReturnType<typeof getZonedParts>): number {
	return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

export function getUnixTimeInTz(
	year: number,
	month: number,
	day: number,
	hour: number,
	minute: number,
	timezone: string
): number {
	const requested = Date.UTC(year, month - 1, day, hour, minute);
	const offsets = new Set<number>();
	// Examine offsets on both sides of transitions (including date-line jumps).
	// A single offset estimated on the target date cannot resolve DST correctly.
	for (let delta = -48; delta <= 48; delta += 6) {
		const sample = requested + delta * 3_600_000;
		offsets.add(wallTimestamp(getZonedParts(sample / 1000, timezone)) - sample);
	}

	const candidates = [...offsets].map((offset) => requested - offset);
	const exact = candidates
		.filter((candidate) => wallTimestamp(getZonedParts(candidate / 1000, timezone)) === requested)
		.sort((a, b) => a - b);
	// In a fall-back overlap, select the earlier occurrence consistently.
	if (exact.length) return exact[0] / 1000;

	// A spring-forward gap has no matching instant. Shift forward by the gap,
	// keeping the minute where possible (02:30 -> 03:30 for a one-hour gap).
	const later = candidates
		.map((candidate) => ({
			candidate,
			wall: wallTimestamp(getZonedParts(candidate / 1000, timezone))
		}))
		.filter(({ wall }) => wall > requested)
		.sort((a, b) => a.wall - b.wall || a.candidate - b.candidate);
	if (later.length) return later[0].candidate / 1000;

	// Defensive fallback for unusual historical timezone transitions.
	return Math.max(...candidates) / 1000;
}
