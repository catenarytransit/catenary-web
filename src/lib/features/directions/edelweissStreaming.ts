import {
	normalizePlan,
	streetRoutingRequest,
	isValidPoint,
	type Coordinate,
	type EdelweissItinerary,
	type StreetRoutingSettings
} from './edelweiss';

/** Stateless queries: retain the same origin, destination, time and travel options for every cursor. */
export type EdelweissRouteQuery = Record<string, unknown>;
export type PageDirection = 'before' | 'after';

export interface EdelweissPage {
	requestId: string;
	itineraries: EdelweissItinerary[];
	direct: EdelweissItinerary[];
	previousPageCursor: string | null;
	nextPageCursor: string | null;
}

export const INITIAL_RESULTS = 8;
export const EARLIER_PAGE_RESULTS = 4;
export const LATER_PAGE_RESULTS = 5;
const EDELWEISS_ORIGIN = 'https://edelweiss.catenarymaps.org';

let requestSequence = 0;
export function newRouteRequestId(): string {
	return `catenary-web-${Date.now()}-${++requestSequence}`;
}

export function createRouteQuery(
	origin: Coordinate,
	destination: Coordinate,
	time: number,
	arriveBy: boolean,
	settings: StreetRoutingSettings
): EdelweissRouteQuery {
	if (!isValidPoint(origin) || !isValidPoint(destination)) {
		throw new Error('Select valid starting and finishing locations');
	}
	return {
		from: { lat: origin.lat, lon: origin.lon },
		to: { lat: destination.lat, lon: destination.lon },
		...(arriveBy ? { arrival_unix_seconds: Math.floor(time) } : { departure_unix_seconds: Math.floor(time) }),
		...streetRoutingRequest(settings),
		detailed_legs: true,
		timetable_view: true,
		timeout_seconds: 8
	};
}

/** Same query for HTTP and WebSocket; page cursors are opaque and may be reused after reconnecting. */
export function pageQuery(
	base: EdelweissRouteQuery,
	direction: PageDirection,
	cursor?: string
): EdelweissRouteQuery {
	return {
		...base,
		...(cursor ? { page_cursor: cursor } : {}),
		number_of_results_before: direction === 'before' ? (cursor ? EARLIER_PAGE_RESULTS : INITIAL_RESULTS) : 0,
		number_of_results_after: direction === 'after' ? (cursor ? LATER_PAGE_RESULTS : INITIAL_RESULTS) : 0
	};
}

export function emptyEdelweissPage(requestId: string): EdelweissPage {
	return { requestId, itineraries: [], direct: [], previousPageCursor: null, nextPageCursor: null };
}

export function parseEdelweissPage(value: unknown, requestId: string): EdelweissPage {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Edelweiss returned invalid routing data');
	}
	const data = value as Record<string, unknown>;
	return {
		requestId,
		itineraries: normalizePlan({ itineraries: data.itineraries, direct: [] }),
		direct: normalizePlan({ itineraries: [], direct: data.direct }),
		previousPageCursor: typeof data.previousPageCursor === 'string' ? data.previousPageCursor : null,
		nextPageCursor: typeof data.nextPageCursor === 'string' ? data.nextPageCursor : null
	};
}

/** Server IDs are stable across page snapshots. Pre-183 replies still have a deterministic fallback. */
export function itineraryIdentity(itinerary: EdelweissItinerary): string {
	if (itinerary.id) return itinerary.id;
	return JSON.stringify([
		itinerary.startTime,
		itinerary.endTime,
		itinerary.legs.map(leg => [leg.mode, leg.startTime, leg.endTime, leg.routeId, leg.from?.name, leg.to?.name])
	]);
}

/** Snapshot replacement occurs per page; only then merge/deduplicate and sort transit connections. */
export function mergeEdelweissPages(pages: readonly EdelweissPage[]): EdelweissItinerary[] {
	const transit: EdelweissItinerary[] = [];
	const direct: EdelweissItinerary[] = [];
	const seen = new Set<string>();
	for (const page of pages) {
		for (const itinerary of page.itineraries) {
			const id = itineraryIdentity(itinerary);
			if (seen.has(id)) continue;
			seen.add(id);
			transit.push(itinerary);
		}
	}
	for (const page of pages) {
		for (const itinerary of page.direct) {
			const id = itineraryIdentity(itinerary);
			if (seen.has(id)) continue;
			seen.add(id);
			direct.push(itinerary);
		}
	}
	transit.sort((a, b) =>
		Date.parse(a.startTime) - Date.parse(b.startTime) ||
		Date.parse(a.endTime) - Date.parse(b.endTime)
	);
	return [...transit, ...direct];
}

class BackendRouteError extends Error {}

/**
 * The planner retains one connection from mount until unmount. Completed requests
 * release only their own routing state; the transport remains available for later pages.
 */
let sharedSocket: WebSocket | null = null;
let connecting: Promise<WebSocket> | null = null;
let holders = 0;
type PendingRoute = { onMessage: (message: Record<string, unknown>) => void; onFailure: (error: Error) => void };
const pendingRoutes = new Map<string, PendingRoute>();

function closeSharedSocket(): void {
	const socket = sharedSocket;
	sharedSocket = null;
	connecting = null;
	if (socket) {
		socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
		if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
	}
	for (const pending of pendingRoutes.values()) pending.onFailure(new Error('Routing WebSocket disconnected'));
	pendingRoutes.clear();
}

function ensureSocket(): Promise<WebSocket> {
	if (sharedSocket?.readyState === WebSocket.OPEN) return Promise.resolve(sharedSocket);
	if (connecting) return connecting;
	if (typeof WebSocket === 'undefined') return Promise.reject(new Error('WebSocket unavailable'));
	const url = new URL('/v2/route/ws', EDELWEISS_ORIGIN);
	url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	connecting = new Promise((resolve, reject) => {
		let socket: WebSocket;
		try { socket = new WebSocket(url.toString()); }
		catch (error) { connecting = null; reject(error); return; }
		sharedSocket = socket;
		const timeout = setTimeout(() => {
			if (sharedSocket !== socket) return;
			closeSharedSocket();
			reject(new Error('Routing WebSocket connection timed out'));
		}, 10_000);
		socket.onopen = () => {
			clearTimeout(timeout);
			if (sharedSocket !== socket) return;
			connecting = null;
			resolve(socket);
		};
		socket.onmessage = (event) => {
			let message: Record<string, unknown>;
			try { message = JSON.parse(String(event.data)); }
			catch { return; }
			if (typeof message.requestId === 'string') pendingRoutes.get(message.requestId)?.onMessage(message);
		};
		const failed = () => {
			clearTimeout(timeout);
			if (sharedSocket !== socket) return;
			closeSharedSocket();
			reject(new Error('Routing WebSocket disconnected'));
		};
		socket.onerror = failed;
		socket.onclose = failed;
	});
	return connecting;
}

/** Opens the socket immediately on planner mount, even before a destination is selected. */
export function retainEdelweissConnection(): () => void {
	holders++;
	void ensureSocket().catch(() => { /* The next route may fall back to HTTP. */ });
	let released = false;
	return () => {
		if (released) return;
		released = true;
		if (--holders === 0) closeSharedSocket();
	};
}

function socketPage(
	query: EdelweissRouteQuery,
	requestId: string,
	signal: AbortSignal,
	onSnapshot: (page: EdelweissPage) => void
): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal.aborted) { reject(new DOMException('Routing request cancelled', 'AbortError')); return; }
		let settled = false;
		let sequence = 0;
		let sent = false;
		const onAbort = () => finish(new DOMException('Routing request cancelled', 'AbortError'));
		function finish(error?: Error): void {
			if (settled) return;
			settled = true;
			signal.removeEventListener('abort', onAbort);
			pendingRoutes.delete(requestId);
			if (sent && sharedSocket?.readyState === WebSocket.OPEN && error?.name === 'AbortError')
				sharedSocket.send(JSON.stringify({ type: 'cancel', requestId }));
			if (error) reject(error);
			else resolve();
		}
		signal.addEventListener('abort', onAbort, { once: true });
		void ensureSocket().then(socket => {
			if (settled || signal.aborted) { onAbort(); return; }
			pendingRoutes.set(requestId, {
				onFailure: error => finish(error),
				onMessage: message => {
					try {
						switch (message.type) {
							case 'snapshot':
								if (typeof message.sequence !== 'number' || message.sequence <= sequence) return;
								sequence = message.sequence;
								onSnapshot(parseEdelweissPage(message.response, requestId));
								break;
							case 'complete':
								onSnapshot(parseEdelweissPage(message.response, requestId));
								finish();
								break;
							case 'error':
								finish(new BackendRouteError(typeof message.message === 'string' ? message.message : 'Routing failed'));
								break;
							case 'cancelled':
								finish(new Error('Routing request cancelled'));
								break;
						}
					} catch (error) { finish(error instanceof Error ? error : new Error('Invalid routing response')); }
				}
			});
			try {
				socket.send(JSON.stringify({ type: 'route', requestId, query: { ...query, request_id: requestId } }));
				sent = true;
			} catch (error) { finish(error instanceof Error ? error : new Error('Unable to send routing request')); }
		}).catch(error => finish(error instanceof Error ? error : new Error('Routing connection failed')));
	});
}

/** HTTP is a functional fallback when a proxy does not yet support WebSocket upgrades. */
async function httpPage(
	query: EdelweissRouteQuery,
	requestId: string,
	signal: AbortSignal,
	onSnapshot: (page: EdelweissPage) => void
): Promise<void> {
	const response = await fetch(new URL('/v2/route', EDELWEISS_ORIGIN), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ ...query, request_id: requestId }),
		signal
	});
	if (!response.ok) {
		const text = (await response.text()).slice(0, 240);
		throw new Error(text || `Edelweiss returned HTTP ${response.status}`);
	}
	onSnapshot(parseEdelweissPage(await response.json(), requestId));
}

export async function streamEdelweissPage(
	query: EdelweissRouteQuery,
	requestId: string,
	signal: AbortSignal,
	onSnapshot: (page: EdelweissPage) => void
): Promise<void> {
	try {
		await socketPage(query, requestId, signal, onSnapshot);
	} catch (error) {
		if (signal.aborted || error instanceof BackendRouteError) throw error;
		await httpPage(query, requestId, signal, onSnapshot);
	}
}

/**
 * Collect replacement WebSocket snapshots without publishing intermediate results.
 * Resolves only after the authoritative "complete" frame (or successful HTTP fallback).
 * Intended for prepended earlier pages so all new cards enter in one animation batch.
 */
export async function loadCompleteEdelweissPage(
	query: EdelweissRouteQuery,
	requestId: string,
	signal: AbortSignal
): Promise<EdelweissPage> {
	let finalPage: EdelweissPage | null = null;
	await streamEdelweissPage(query, requestId, signal, (page) => {
		finalPage = page; // Each snapshot replaces its predecessor, never accumulates.
	});
	if (!finalPage) throw new Error('Edelweiss completed without a routing page');
	return finalPage;
}
