export interface ParsedCoordinate {
	lat: number;
	lon: number;
	label: string;
}

function axisValue(raw: string, axis: 'lat' | 'lon', hemisphere?: string): number | null {
	const direction = (hemisphere || raw.match(/[NSEW]/i)?.[0] || '').toUpperCase();
	if (direction && (axis === 'lat' ? !/[NS]/.test(direction) : !/[EW]/.test(direction))) return null;
	const cleaned = raw.replace(/[NSEW]/gi, '').replace(/[°º]/g, ' ').replace(/[′'’]/g, ' ').replace(/[″"”]/g, ' ');
	const values = [...cleaned.matchAll(/[+-]?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
	if (values.length < 1 || values.length > 3 || values.some((value) => !Number.isFinite(value))) return null;
	if (values.length > 1 && !/[°º′'’″"”]/.test(raw)) return null;
	const degree = values[0];
	const magnitude = Math.abs(degree) + (Math.abs(values[1] ?? 0) / 60) + (Math.abs(values[2] ?? 0) / 3600);
	const negative = direction ? /[SW]/.test(direction) : degree < 0;
	const result = negative ? -magnitude : magnitude;
	const limit = axis === 'lat' ? 90 : 180;
	return Math.abs(result) <= limit ? result : null;
}

function coordinateFromAxes(first: string, second: string, firstHemisphere?: string, secondHemisphere?: string): ParsedCoordinate | null {
	const firstDirection = firstHemisphere || first.match(/[NSEW]/i)?.[0];
	const secondDirection = secondHemisphere || second.match(/[NSEW]/i)?.[0];
	let lat: number | null;
	let lon: number | null;
	if (firstDirection && /[EW]/i.test(firstDirection)) {
		lon = axisValue(first, 'lon', firstHemisphere);
		lat = axisValue(second, 'lat', secondHemisphere);
	} else {
		lat = axisValue(first, 'lat', firstHemisphere);
		lon = axisValue(second, 'lon', secondHemisphere);
	}
	if (lat === null || lon === null) return null;
	return { lat, lon, label: `${Number(lat.toFixed(6))}, ${Number(lon.toFixed(6))}` };
}

/** Parse decimal or DMS latitude/longitude pairs, with optional signs and hemisphere letters. */
export function parseCoordinateInput(input: string): ParsedCoordinate | null {
	const text = input.trim().replace(/[−–—]/g, '-').replace(/\s+/g, ' ');
	if (!text || !/\d/.test(text)) return null;

	const markers = [...text.matchAll(/[NSEW]/gi)];
	if (markers.length === 2) {
		const first = markers[0];
		const second = markers[1];
		const firstHemisphere = first[0].toUpperCase();
		const secondHemisphere = second[0].toUpperCase();
		const firstEnd = (first.index ?? 0) + first[0].length;
		const secondEnd = (second.index ?? 0) + second[0].length;
		const prefixForm = text.slice(0, first.index).trim() === '';
		const firstAxis = prefixForm ? text.slice(firstEnd, second.index).trim() : text.slice(0, first.index).trim();
		const secondAxis = prefixForm ? text.slice(secondEnd).trim() : text.slice(firstEnd, second.index).trim();
		if (firstAxis && secondAxis) {
			const result = coordinateFromAxes(firstAxis, secondAxis, firstHemisphere, secondHemisphere);
			if (result) return result;
		}
	}

	const separatorParts = text.split(/\s*[,;]\s*/);
	if (separatorParts.length === 2) {
		const result = coordinateFromAxes(separatorParts[0], separatorParts[1]);
		if (result) return result;
	}

	const dmsParts = [...text.matchAll(/[+-]?\d+(?:\.\d+)?\s*°(?:\s*\d+(?:\.\d+)?\s*['′’])?(?:\s*\d+(?:\.\d+)?\s*["″”])?/g)];
	if (dmsParts.length === 2) {
		const result = coordinateFromAxes(dmsParts[0][0], dmsParts[1][0]);
		if (result) return result;
	}

	const decimalParts = text.split(/\s+/);
	if (decimalParts.length === 2) return coordinateFromAxes(decimalParts[0], decimalParts[1]);
	return null;
}
