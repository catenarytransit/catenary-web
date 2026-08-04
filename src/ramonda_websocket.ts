import { writable } from 'svelte/store';
import type {
	GtfsRtRefreshData,
	QueryTripInformationParams,
	RamondaClientMessage,
	TripIntroductionInformation
} from '$lib/types/backend/ramonda';
import { isRamondaServerMessage } from '$lib/types/backend/ramonda';
import type { WebSocketStatus } from '$lib/types/backend/common';

export const ramonda_status = writable<WebSocketStatus>('disconnected');
export const ramonda_trip_data = writable<TripIntroductionInformation | null>(null);
export const ramonda_update_data = writable<GtfsRtRefreshData | null>(null);
export const ramonda_error = writable<string | null>(null);

let socket: WebSocket | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

// Active state for resubscription on connection loss
let activeChateau: string | null = null;
let activeParams: QueryTripInformationParams | null = null;

function send(message: RamondaClientMessage): void {
	if (socket?.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify(message));
	}
}

function ensureConnection() {
	if (
		socket &&
		(socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
	) {
		return;
	}

	ramonda_status.set('connecting');
	const url = 'wss://ramonda.catenarymaps.org/ws/';
	console.log(`Connecting to Ramonda WS: ${url}`);

	socket = new WebSocket(url);

	socket.onopen = () => {
		console.log('Ramonda WS Connected');
		ramonda_status.set('connected');
		ramonda_error.set(null);

		heartbeatInterval = setInterval(() => {
			send({ type: 'ping' });
		}, 10000);

		if (activeChateau && activeParams) {
			const msg: RamondaClientMessage = {
				type: 'subscribe_trip',
				chateau: activeChateau,
				...activeParams
			};
			console.log('Resending subscribe to Ramonda:', msg);
			send(msg);
		}
	};

	socket.onmessage = (event: MessageEvent<unknown>) => {
		try {
			if (typeof event.data !== 'string') {
				console.warn('Ignoring non-text Ramonda WS message');
				return;
			}

			const parsed: unknown = JSON.parse(event.data);
			if (!isRamondaServerMessage(parsed)) {
				console.warn('Ignoring invalid Ramonda WS message', parsed);
				return;
			}

			if (parsed.type === 'initial_trip') {
				ramonda_trip_data.set(parsed.data);
			} else if (parsed.type === 'update_trip') {
				ramonda_update_data.set(parsed.data);
			} else if (parsed.type === 'pong') {
				console.log('Ramonda WS received pong');
			} else if (parsed.type === 'error') {
				ramonda_error.set(parsed.message);
				console.error('Ramonda WS Error message:', parsed.message);
			}
		} catch (error) {
			console.error('Error parsing Ramonda WS message', error);
		}
	};

	socket.onclose = (event) => {
		console.log('Ramonda WS Closed', event.code, event.reason);
		ramonda_status.set('disconnected');
		socket = null;

		if (heartbeatInterval) {
			clearInterval(heartbeatInterval);
			heartbeatInterval = null;
		}

		// Auto-reconnect after a delay
		setTimeout(() => {
			console.log('Attempting to reconnect Ramonda WS...');
			ensureConnection();
		}, 3000);
	};

	socket.onerror = (error) => {
		console.error('Ramonda WebSocket error', error);
		ramonda_status.set('error');
	};
}

function nullIfEmpty(value: string | null | undefined): string | null | undefined {
	return value === '' ? null : value;
}

function sanitiseParams(params: QueryTripInformationParams): QueryTripInformationParams {
	const sanitised: QueryTripInformationParams = {
		trip_id: params.trip_id,
		start_time: nullIfEmpty(params.start_time),
		start_date: nullIfEmpty(params.start_date),
		route_id: nullIfEmpty(params.route_id)
	};

	if (sanitised.start_time?.includes('T')) {
		try {
			const date = new Date(sanitised.start_time);
			if (!Number.isNaN(date.getTime())) {
				const hh = String(date.getUTCHours()).padStart(2, '0');
				const mm = String(date.getUTCMinutes()).padStart(2, '0');
				const ss = String(date.getUTCSeconds()).padStart(2, '0');
				sanitised.start_time = `${hh}:${mm}:${ss}`;

				if (!sanitised.start_date) {
					const yyyy = date.getUTCFullYear();
					const month = String(date.getUTCMonth() + 1).padStart(2, '0');
					const day = String(date.getUTCDate()).padStart(2, '0');
					sanitised.start_date = `${yyyy}${month}${day}`;
				}
			}
		} catch (error) {
			console.error('Error formatting start_time/start_date in ramonda_websocket', error);
		}
	}

	return sanitised;
}

export function connectRamondaWebSocket(chateau: string, params: QueryTripInformationParams) {
	ensureConnection();

	const sanitisedParams = sanitiseParams(params);
	activeChateau = chateau;
	activeParams = sanitisedParams;

	// reset trip data stores
	ramonda_trip_data.set(null);
	ramonda_update_data.set(null);
	ramonda_error.set(null);

	const msg: RamondaClientMessage = {
		type: 'subscribe_trip',
		chateau,
		...sanitisedParams
	};
	console.log('Sending subscribe to Ramonda:', msg);
	send(msg);
}

export function initRamondaWebSocket() {
	ensureConnection();
}

export function disconnectRamondaWebSocket() {
	if (activeChateau && activeParams) {
		console.log('Unsubscribing from Trip');
		send({
			type: 'unsubscribe_trip',
			chateau: activeChateau,
			...activeParams
		});
	}

	activeChateau = null;
	activeParams = null;
	ramonda_trip_data.set(null);
	ramonda_update_data.set(null);
}
