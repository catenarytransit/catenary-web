import { writable } from 'svelte/store';

export const ramonda_status = writable<'connecting' | 'connected' | 'disconnected' | 'error'>(
	'disconnected'
);
export const ramonda_trip_data = writable<any>(null);
export const ramonda_update_data = writable<any>(null);
export const ramonda_error = writable<string | null>(null);

let socket: WebSocket | null = null;
let heartbeatInterval: any = null;

// Active state for resubscription on connection loss
let activeChateau: string | null = null;
let activeParams: any = null;

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

		heartbeatInterval = setInterval(() => {
			if (socket && socket.readyState === WebSocket.OPEN) {
				socket.send(JSON.stringify({ type: 'ping' }));
			}
		}, 10000);

		if (activeChateau && activeParams) {
			const msg = {
				type: 'subscribe_trip',
				chateau: activeChateau,
				...activeParams
			};
			console.log('Resending subscribe to Ramonda:', msg);
			socket?.send(JSON.stringify(msg));
		}
	};

	socket.onmessage = (event) => {
		try {
			const msg = JSON.parse(event.data);

			if (msg.type === 'initial_trip') {
				ramonda_trip_data.set(msg.data);
			} else if (msg.type === 'update_trip') {
				ramonda_update_data.set(msg.data);
			} else if (msg.type === 'pong') {
				console.log('Ramonda WS received pong');
			} else if (msg.type === 'error') {
				ramonda_error.set(msg.message);
				console.error('Ramonda WS Error message:', msg.message);
			}
		} catch (e) {
			console.error('Error parsing Ramonda WS message', e);
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

	socket.onerror = (e) => {
		console.error('Ramonda WebSocket error', e);
		ramonda_status.set('error');
	};
}

export function connectRamondaWebSocket(chateau: string, params: any) {
	ensureConnection();

	const sanitizedParams = { ...params };
	for (const key in sanitizedParams) {
		if (sanitizedParams[key] === '') {
			sanitizedParams[key] = null;
		}
	}
	if (sanitizedParams.start_time && sanitizedParams.start_time.includes('T')) {
		try {
			const date = new Date(sanitizedParams.start_time);
			if (!isNaN(date.getTime())) {
				const hh = String(date.getUTCHours()).padStart(2, '0');
				const mm = String(date.getUTCMinutes()).padStart(2, '0');
				const ss = String(date.getUTCSeconds()).padStart(2, '0');
				sanitizedParams.start_time = `${hh}:${mm}:${ss}`;

				if (!sanitizedParams.start_date) {
					const yyyy = date.getUTCFullYear();
					const month = String(date.getUTCMonth() + 1).padStart(2, '0');
					const day = String(date.getUTCDate()).padStart(2, '0');
					sanitizedParams.start_date = `${yyyy}${month}${day}`;
				}
			}
		} catch (e) {
			console.error('Error formatting start_time/start_date in ramonda_websocket', e);
		}
	}

	activeChateau = chateau;
	activeParams = sanitizedParams;

	// Send subscribe
	const msg = {
		type: 'subscribe_trip',
		chateau: chateau,
		...sanitizedParams
	};

	// reset trip data stores
	ramonda_trip_data.set(null);
	ramonda_update_data.set(null);
	ramonda_error.set(null);

	if (socket && socket.readyState === WebSocket.OPEN) {
		console.log('Sending subscribe to Ramonda:', msg);
		socket.send(JSON.stringify(msg));
	}
}

export function initRamondaWebSocket() {
	ensureConnection();
}

export function disconnectRamondaWebSocket() {
	if (socket && socket.readyState === WebSocket.OPEN && activeChateau) {
		console.log('Unsubscribing from Trip');
		const msg = {
			type: 'unsubscribe_trip',
			chateau: activeChateau,
			...activeParams
		};
		socket.send(JSON.stringify(msg));
	}

	activeChateau = null;
	activeParams = null;
	ramonda_trip_data.set(null);
	ramonda_update_data.set(null);
}
