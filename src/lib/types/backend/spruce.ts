import type {
	AspenisedVehiclePositionOutput,
	GtfsDateString,
	IsoDateString,
	UnixMilliseconds
} from './common';
import { isRecord } from './common';


export type RealtimeCategory = 'bus' | 'rail' | 'metro' | 'other';
export type TrajectoryMode =
	| 'bus'
	| 'trolleybus'
	| 'rail'
	| 'tram'
	| 'subway'
	| 'metro'
	| 'funicular'
	| 'ferry'
	| 'cable_car'
	| 'gondola'
	| 'monorail'
	| string;

export interface BoundsInputPerLevel {
	min_x: number;
	max_x: number;
	min_y: number;
	max_y: number;
}

export interface BoundsInputV3 {
	level5: BoundsInputPerLevel;
	level7: BoundsInputPerLevel;
	level8: BoundsInputPerLevel;
	level12: BoundsInputPerLevel;
}

export interface SubscribeMapV2Params {
	categories: RealtimeCategory[];
	bounds_input: BoundsInputV3;
}

export type TileVehicleGrid = Record<
	string,
	Record<string, Record<string, AspenisedVehiclePositionOutput>>
>;

export interface EachCategoryPayloadV2 {
	vehicle_positions: TileVehicleGrid | null;
	last_updated_time_ms: UnixMilliseconds;
	replaces_all: boolean;
	z_level: number;
	list_of_agency_ids: string[] | null;
}

export type PositionDataCategoryV2 = Record<RealtimeCategory, EachCategoryPayloadV2 | null>;

export interface EachChateauResponseV2 {
	categories: PositionDataCategoryV2 | null;
}

export interface BulkFetchResponseV2 {
	chateaus: Record<string, EachChateauResponseV2>;
}

export interface ClientTrajectorySubscriptionParams {
	bbox: number[];
	zoom: number;
	modes: TrajectoryMode[];
	precision?: number | null;
	client_reference: string;
}

export interface AspenisedTrajectorySegment {
	from_stop_index: number;
	to_stop_index: number;
	coordinates: Array<[number, number]>;
}

export interface AspenisedTrajectoryStop {
	name: string;
	stop_id: string | null;
	lat: number;
	lon: number;
	track: string | null;
	modes: string[];
	arrival: IsoDateString;
	departure: IsoDateString;
}

export interface AspenisedTrajectory {
	unique_trip_id: string;
	chateau_id: string;
	trip_id: string;
	route_id: string | null;
	start_time: string | null;
	start_date: GtfsDateString | null;
	display_name: string;
	mode: string;
	color: string | null;
	text_color: string | null;
	route_short_name: string | null;
	route_long_name: string | null;
	trip_short_name: string | null;
	route_type: number;
	distance: number;
	segments: AspenisedTrajectorySegment[];
	stops: AspenisedTrajectoryStop[];
	real_time: boolean;
}

export interface TrajectoryWrapper {
	source: string;
	timestamp: UnixMilliseconds;
	client_reference: string;
	content: AspenisedTrajectory;
}

export interface TrajectoryDataByChateau {
	[chateau: string]: {
		content: TrajectoryWrapper[];
		timestamp: UnixMilliseconds;
	};
}

export type SpruceClientMessage =
	| ({ type: 'subscribe_map_v2' } & SubscribeMapV2Params)
	| { type: 'unsubscribe_map_v2' }
	| ({ type: 'subscribe_trajectories' } & ClientTrajectorySubscriptionParams)
	| { type: 'unsubscribe_trajectories' }
	| { type: 'ping' };

function isTrajectoryWrapper(value: unknown): value is TrajectoryWrapper {
	if (!isRecord(value) || !isRecord(value.content)) return false;
	return (
		typeof value.source === 'string' &&
		typeof value.timestamp === 'number' &&
		typeof value.client_reference === 'string' &&
		typeof value.content.unique_trip_id === 'string' &&
		Array.isArray(value.content.segments) &&
		Array.isArray(value.content.stops)
	);
}

export type SpruceServerMessage =
	| ({ type: 'map_update' } & BulkFetchResponseV2)
	| {
			type: 'buffer';
			timestamp: UnixMilliseconds;
			client_reference: string;
			chateau: string;
			content: TrajectoryWrapper[];
			chunk_index: number;
			total_chunks: number;
		}
	| { type: 'pong' }
	| { type: 'error'; message: string };

export function isSpruceServerMessage(value: unknown): value is SpruceServerMessage {
	if (!isRecord(value) || typeof value.type !== 'string') return false;

	switch (value.type) {
		case 'map_update':
			return isRecord(value.chateaus);
		case 'buffer':
			return (
				typeof value.timestamp === 'number' &&
				typeof value.client_reference === 'string' &&
				typeof value.chateau === 'string' &&
				Array.isArray(value.content) &&
				value.content.every(isTrajectoryWrapper) &&
				typeof value.chunk_index === 'number' &&
				typeof value.total_chunks === 'number'
			);
		case 'error':
			return typeof value.message === 'string';
		case 'pong':
			return true;
		default:
			return false;
	}
}

/**
 * Accept the canonical Serde shape and the two legacy wrapper shapes that the
 * web client previously tolerated during the Spruce websocket migration.
 */
export function extractSpruceMapPayload(value: unknown): BulkFetchResponseV2 | null {
	if (!isRecord(value)) return null;
	if (isRecord(value.chateaus)) return value as unknown as BulkFetchResponseV2;

	for (const key of ['data', 'map_update'] as const) {
		const candidate = value[key];
		if (isRecord(candidate) && isRecord(candidate.chateaus)) {
			return candidate as unknown as BulkFetchResponseV2;
		}
	}

	return null;
}
