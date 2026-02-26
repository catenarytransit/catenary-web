import { writable } from 'svelte/store';

export const spruce_status = writable<'connecting' | 'connected' | 'disconnected' | 'error'>(
	'disconnected'
);
export const spruce_trip_data = writable<any>(null);
export const spruce_update_data = writable<any>(null);
export const spruce_error = writable<string | null>(null);
export const spruce_map_data = writable<any>(null);

let socket: WebSocket | null = null;
let heartbeatInterval: any = null;

// Trip State
let activeChateau: string | null = null;
let activeParams: any = null;

function ensureConnection() {
	if (
		socket &&
		(socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
	) {
		return;
	}

	spruce_status.set('connecting');
	const url = 'wss://spruce.catenarymaps.org/ws/';
	console.log(`Connecting to Spruce WS: ${url}`);

	socket = new WebSocket(url);

	socket.onopen = () => {
		console.log('Spruce WS Connected');
		spruce_status.set('connected');

		// Resubscribe Trip if active
		if (activeChateau && activeParams) {
			const msg = {
				type: 'subscribe_trip',
				chateau: activeChateau,
				...activeParams
			};
			console.log('Resending subscribe to Spruce:', msg);
			socket?.send(JSON.stringify(msg));
		}
	};

	socket.onmessage = (event) => {
		try {
			const msg = JSON.parse(event.data);

			if (msg.type === 'initial_trip') {
				spruce_trip_data.set(msg.data);
			} else if (msg.type === 'update_trip') {
				spruce_update_data.set(msg.data);
			} else if (msg.type === 'map_update') {
				// Check for payload in possibly different locations due to serde serialization
				// Try msg.data, msg.map_update, or msg itself if fields like 'chateaus' are present
				let payload = msg.data || msg.map_update;

				if (!payload && msg.chateaus) {
					payload = msg;
				}

				if (payload) {
					spruce_map_data.set(payload);
				}
			} else if (msg.type === 'error') {
				spruce_error.set(msg.message);
				console.error('Spruce WS Error message:', msg.message);
			}
		} catch (e) {
			console.error('Error parsing Spruce WS message', e);
		}
	};

	socket.onclose = (event) => {
		console.log('Spruce WS Closed', event.code, event.reason);
		spruce_status.set('disconnected');
		socket = null;

		// Optional: Auto-reconnect logic could go here, but for now we rely on next action triggering ensureConnection
	};

	socket.onerror = (e) => {
		console.error('Spruce WebSocket error', e);
		spruce_status.set('error');
	};
}

export function initSpruceWebSocket() {
	ensureConnection();
}

export function connectSpruceWebSocket(chateau: string, params: any) {
	ensureConnection();
	activeChateau = chateau;
	activeParams = params;

	// Send subscribe
	const msg = {
		type: 'subscribe_trip',
		chateau: chateau,
		...params
	};

	// reset trip data stores
	spruce_trip_data.set(null);
	spruce_update_data.set(null);
	spruce_error.set(null);

	if (socket && socket.readyState === WebSocket.OPEN) {
		console.log('Sending subscribe to Spruce:', msg);
		socket.send(JSON.stringify(msg));
	}
}

export function updateMap(params: any) {
	ensureConnection();
	// params should correspond to BulkFetchParamsV3 structure
	const msg = {
		type: 'update_map',
		...params
	};
	if (socket && socket.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify(msg));
	}
}

export function disconnectSpruceWebSocket() {
	if (socket && socket.readyState === WebSocket.OPEN && activeChateau) {
		console.log('Unsubscribing from Trip');
		const msg = {
			type: 'unsubscribe_trip',
			chateau: activeChateau,
			// Include params if needed for unsubscribe
			...activeParams
		};
		socket.send(JSON.stringify(msg));
	}

	activeChateau = null;
	activeParams = null;
	spruce_trip_data.set(null);
	spruce_update_data.set(null);

	// We do NOT close the socket, to allow Map updates to continue.
}
