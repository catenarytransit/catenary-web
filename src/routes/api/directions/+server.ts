import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

function validPoint(value: unknown): boolean {
	if (!value || typeof value !== 'object') return false;
	const p = value as Record<string, unknown>;
	return typeof p.lat === 'number' && typeof p.lon === 'number' &&
		Number.isFinite(p.lat) && Number.isFinite(p.lon) &&
		p.lat >= -90 && p.lat <= 90 && p.lon >= -180 && p.lon <= 180;
}

export const POST: RequestHandler = async ({ request, fetch }) => {
	let payload: Record<string, unknown>;
	try {
		payload = await request.json();
	} catch {
		return new Response('Expected a JSON routing request', { status: 400 });
	}
	const arriveBy = payload.arrival_unix_seconds !== undefined;
	const time = arriveBy ? payload.arrival_unix_seconds : payload.departure_unix_seconds;
	if (!validPoint(payload?.from) || !validPoint(payload?.to) ||
		(arriveBy && payload.departure_unix_seconds !== undefined) ||
		typeof time !== 'number' ||
		!Number.isSafeInteger(time) || time <= 0) {
		return new Response('Invalid routing coordinates or requested time', { status: 400 });
	}

	// HTTPS deployment by default. EDELWEISS_URL can override for development.
	const origin = env.EDELWEISS_URL || 'https://edelweiss.catenarymaps.org';
	let upstream: URL;
	try {
		upstream = new URL('/v1/route', origin);
		if (!['https:', 'http:'].includes(upstream.protocol)) throw new Error('Invalid protocol');
	} catch {
		return new Response('Invalid EDELWEISS_URL configuration', { status: 503 });
	}

	try {
		const result = await fetch(upstream.toString(), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				from: payload.from,
				to: payload.to,
				...(arriveBy ? { arrival_unix_seconds: time } : { departure_unix_seconds: time }),
				detailed_legs: true
			}),
			signal: AbortSignal.timeout(60_000)
		});
		if (!result.ok) {
			const detail = (await result.text()).slice(0, 500);
			return new Response(detail || 'Routing service unavailable', { status: result.status });
		}
		return new Response(result.body, {
			status: 200,
			headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
		});
	} catch (error) {
		console.error('Edelweiss proxy failed:', error);
		return new Response('Unable to reach Edelweiss', { status: 502 });
	}
};
