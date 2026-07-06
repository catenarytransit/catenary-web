import { writable } from 'svelte/store';

export const spruce_status = writable<'connecting' | 'connected' | 'disconnected' | 'error'>(
	'disconnected'
);
export const spruce_error = writable<string | null>(null);
export const spruce_map_data = writable<any>(null);
export const spruce_trajectory_data = writable<Record<string, { content: any[]; timestamp: number }>>({});

let trajectory_timestamps: Record<string, number> = {};
let trajectory_accumulators: Record<string, any[]> = {};

let socket: WebSocket | null = null;
let heartbeatInterval: any = null;

// Active state for resubscription on connection loss
let activeMapParams: any = null;
let activeTrajectoryParams: any = null;

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

		heartbeatInterval = setInterval(() => {
			if (socket && socket.readyState === WebSocket.OPEN) {
				socket.send(JSON.stringify({ type: 'unsubscribe_trip', chateau: 'ping-noop' }));
			}
		}, 10000);


		// Resubscribe Map if active
		if (activeMapParams) {
			const msg = {
				type: 'subscribe_map_v2',
				...activeMapParams
			};
			console.log('Resending subscribe_map to Spruce:', msg);
			socket?.send(JSON.stringify(msg));
		}

		// Resubscribe Trajectories if active
		if (activeTrajectoryParams) {
			const msg = {
				type: 'subscribe_trajectories',
				...activeTrajectoryParams
			};
			console.log('Resending subscribe_trajectories to Spruce:', msg);
			socket?.send(JSON.stringify(msg));
		}
	};

	socket.onmessage = (event) => {
		try {
			const msg = JSON.parse(event.data);

			if (msg.type === 'map_update') {
				// Check for payload in possibly different locations due to serde serialization
				// Try msg.data, msg.map_update, or msg itself if fields like 'chateaus' are present
				let payload = msg.data || msg.map_update;

				if (!payload && msg.chateaus) {
					payload = msg;
				}

				if (payload) {
					spruce_map_data.set(payload);
				}
			} else if (msg.type === 'buffer') {
				if (msg.content) {
					for (const item of msg.content) {
						const traj = item.content;
						if (traj) {
							if (traj.route_id === '') traj.route_id = null;
							if (traj.start_time === '') traj.start_time = null;
							if (traj.start_date === '') traj.start_date = null;

							if (!traj.start_time && traj.stops && traj.stops.length > 0 && traj.stops[0].departure) {
								try {
									const date = new Date(traj.stops[0].departure);
									if (!isNaN(date.getTime())) {
										const hh = String(date.getUTCHours()).padStart(2, '0');
										const mm = String(date.getUTCMinutes()).padStart(2, '0');
										const ss = String(date.getUTCSeconds()).padStart(2, '0');
										traj.start_time = `${hh}:${mm}:${ss}`;

										const yyyy = date.getUTCFullYear();
										const month = String(date.getUTCMonth() + 1).padStart(2, '0');
										const day = String(date.getUTCDate()).padStart(2, '0');
										traj.start_date = `${yyyy}${month}${day}`;
									}
								} catch (e) {
									console.error('Error parsing departure in spruce_websocket', e);
								}
							}
						}
					}
				}

				const chateau = msg.chateau || 'unknown';

				if (msg.timestamp !== trajectory_timestamps[chateau]) {
					trajectory_timestamps[chateau] = msg.timestamp;
					trajectory_accumulators[chateau] = [...(msg.content || [])];
				} else {
					if (!trajectory_accumulators[chateau]) trajectory_accumulators[chateau] = [];
					trajectory_accumulators[chateau].push(...(msg.content || []));
				}

				if (msg.total_chunks === 0 || msg.chunk_index === msg.total_chunks - 1) {
					spruce_trajectory_data.update(data => {
						data[chateau] = {
							content: trajectory_accumulators[chateau],
							timestamp: trajectory_timestamps[chateau]
						};
						return { ...data }; // Trigger Svelte reactivity
					});
				}
			} else if (msg.type === 'pong') {
				console.log('Spruce WS received pong');
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

		if (heartbeatInterval) {
			clearInterval(heartbeatInterval);
			heartbeatInterval = null;
		}

		// Auto-reconnect after a delay
		setTimeout(() => {
			console.log('Attempting to reconnect Spruce WS...');
			ensureConnection();
		}, 3000);
	};

	socket.onerror = (e) => {
		console.error('Spruce WebSocket error', e);
		spruce_status.set('error');
	};
}

export function initSpruceWebSocket() {
	ensureConnection();
}

export function updateMap(params: any) {
	// Defensively unwrap if passed as { params } instead of raw params
	if (params && params.params) {
		params = params.params;
	}

	activeMapParams = params;
	ensureConnection();

	// params should correspond to CategoryAskParamsV2 structure
	const msg = {
		type: 'subscribe_map_v2',
		...params
	};
	if (socket && socket.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify(msg));
	}
}

export function subscribeTrajectories(params: any) {
	activeTrajectoryParams = params;
	ensureConnection();
	const msg = {
		type: 'subscribe_trajectories',
		...params
	};
	if (socket && socket.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify(msg));
	}
}

export function unsubscribeTrajectories() {
	activeTrajectoryParams = null;
	ensureConnection();
	const msg = {
		type: 'unsubscribe_trajectories'
	};
	if (socket && socket.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify(msg));
	}
}


