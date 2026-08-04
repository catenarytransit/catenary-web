import { writable } from 'svelte/store';
import type {
	BulkFetchResponseV2,
	ClientTrajectorySubscriptionParams,
	SpruceClientMessage,
	SubscribeMapV2Params,
	TrajectoryDataByChateau,
	TrajectoryWrapper
} from '$lib/types/backend/spruce';
import {
	extractSpruceMapPayload,
	isSpruceServerMessage
} from '$lib/types/backend/spruce';
import { isRecord } from '$lib/types/backend/common';
import type { WebSocketStatus } from '$lib/types/backend/common';

export const spruce_status = writable<WebSocketStatus>('disconnected');
export const spruce_error = writable<string | null>(null);
export const spruce_map_data = writable<BulkFetchResponseV2 | null>(null);
export const spruce_trajectory_data = writable<TrajectoryDataByChateau>({});

let trajectory_timestamps: Record<string, number> = {};
let trajectory_accumulators: Record<string, TrajectoryWrapper[]> = {};

let socket: WebSocket | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

// Active state for resubscription on connection loss
let activeMapParams: SubscribeMapV2Params | null = null;
let activeTrajectoryParams: ClientTrajectorySubscriptionParams | null = null;

function send(message: SpruceClientMessage): void {
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

	spruce_status.set('connecting');
	const url = 'wss://spruce.catenarymaps.org/ws/';
	console.log(`Connecting to Spruce WS: ${url}`);

	socket = new WebSocket(url);

	socket.onopen = () => {
		console.log('Spruce WS Connected');
		spruce_status.set('connected');
		spruce_error.set(null);

		heartbeatInterval = setInterval(() => {
			send({ type: 'ping' });
		}, 10000);

		// Resubscribe Map if active
		if (activeMapParams) {
			const msg: SpruceClientMessage = {
				type: 'subscribe_map_v2',
				...activeMapParams
			};
			console.log('Resending subscribe_map to Spruce:', msg);
			send(msg);
		}

		// Resubscribe Trajectories if active
		if (activeTrajectoryParams) {
			const msg: SpruceClientMessage = {
				type: 'subscribe_trajectories',
				...activeTrajectoryParams
			};
			console.log('Resending subscribe_trajectories to Spruce:', msg);
			send(msg);
		}
	};

	socket.onmessage = (event: MessageEvent<unknown>) => {
		try {
			if (typeof event.data !== 'string') {
				console.warn('Ignoring non-text Spruce WS message');
				return;
			}

			const parsed: unknown = JSON.parse(event.data);

			if (isRecord(parsed) && parsed.type === 'map_update') {
				const payload = extractSpruceMapPayload(parsed);
				if (payload) spruce_map_data.set(payload);
				return;
			}

			if (!isSpruceServerMessage(parsed)) {
				console.warn('Ignoring invalid Spruce WS message', parsed);
				return;
			}

			if (parsed.type === 'buffer') {
				for (const item of parsed.content) {
					const traj = item.content;
					if (traj.route_id === '') traj.route_id = null;
					if (traj.start_time === '') traj.start_time = null;
					if (traj.start_date === '') traj.start_date = null;

					if (!traj.start_time && traj.stops.length > 0 && traj.stops[0].departure) {
						try {
							const date = new Date(traj.stops[0].departure);
							if (!Number.isNaN(date.getTime())) {
								const hh = String(date.getUTCHours()).padStart(2, '0');
								const mm = String(date.getUTCMinutes()).padStart(2, '0');
								const ss = String(date.getUTCSeconds()).padStart(2, '0');
								traj.start_time = `${hh}:${mm}:${ss}`;

								const yyyy = date.getUTCFullYear();
								const month = String(date.getUTCMonth() + 1).padStart(2, '0');
								const day = String(date.getUTCDate()).padStart(2, '0');
								traj.start_date = `${yyyy}${month}${day}`;
							}
						} catch (error) {
							console.error('Error parsing departure in spruce_websocket', error);
						}
					}
				}

				const chateau = parsed.chateau || 'unknown';

				if (parsed.timestamp !== trajectory_timestamps[chateau]) {
					trajectory_timestamps[chateau] = parsed.timestamp;
					trajectory_accumulators[chateau] = [...parsed.content];
				} else {
					trajectory_accumulators[chateau] ??= [];
					trajectory_accumulators[chateau].push(...parsed.content);
				}

				if (parsed.total_chunks === 0 || parsed.chunk_index === parsed.total_chunks - 1) {
					spruce_trajectory_data.update((data) => ({
						...data,
						[chateau]: {
							content: trajectory_accumulators[chateau],
							timestamp: trajectory_timestamps[chateau]
						}
					}));
				}
			} else if (parsed.type === 'pong') {
				console.log('Spruce WS received pong');
			} else if (parsed.type === 'error') {
				spruce_error.set(parsed.message);
				console.error('Spruce WS Error message:', parsed.message);
			}
		} catch (error) {
			console.error('Error parsing Spruce WS message', error);
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

	socket.onerror = (error) => {
		console.error('Spruce WebSocket error', error);
		spruce_status.set('error');
	};
}

export function initSpruceWebSocket() {
	ensureConnection();
}

type UpdateMapInput = SubscribeMapV2Params | { params: SubscribeMapV2Params };

export function updateMap(input: UpdateMapInput) {
	// Defensively unwrap if passed as { params } instead of raw params.
	const params = 'params' in input ? input.params : input;

	activeMapParams = params;
	ensureConnection();
	send({ type: 'subscribe_map_v2', ...params });
}

export function subscribeTrajectories(params: ClientTrajectorySubscriptionParams) {
	activeTrajectoryParams = params;
	ensureConnection();
	send({ type: 'subscribe_trajectories', ...params });
}

export function unsubscribeTrajectories() {
	activeTrajectoryParams = null;
	ensureConnection();
	send({ type: 'unsubscribe_trajectories' });
}
