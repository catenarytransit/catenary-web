import type {
	AspenStopTimeEvent,
	AspenisedAlert,
	AspenisedVehicleDescriptor,
	IsoDateString,
	PostgresRoute,
	UnixSeconds
} from './common';
import { isRecord } from './common';


export interface QueryTripInformationParams {
	trip_id: string;
	start_time?: string | null;
	start_date?: string | null;
	route_id?: string | null;
}

export interface StopTimeRefresh {
	stop_id: string | null;
	rt_arrival: AspenStopTimeEvent | null;
	rt_departure: AspenStopTimeEvent | null;
	schedule_relationship: number | null;
	gtfs_stop_sequence: number | null;
	rt_platform_string: string | null;
	departure_occupancy_status: number | null;
	platform_info: unknown | null;
}

export interface GtfsRtRefreshData {
	stoptimes: StopTimeRefresh[];
	timestamp: UnixSeconds | null;
	trip_id: string | null;
	chateau: string | null;
}

export interface StopTimeIntroduction {
	stop_id: string;
	name: string | null;
	translations: Record<string, string> | null;
	platform_code: string | null;
	rt_platform_string: string | null;
	timezone: string | null;
	code: string | null;
	longitude: number | null;
	latitude: number | null;
	scheduled_arrival_time_unix_seconds: UnixSeconds | null;
	scheduled_departure_time_unix_seconds: UnixSeconds | null;
	rt_arrival: AspenStopTimeEvent | null;
	rt_departure: AspenStopTimeEvent | null;
	schedule_relationship: number | null;
	gtfs_stop_sequence: number | null;
	interpolated_stoptime_unix_seconds: UnixSeconds | null;
	timepoint: boolean | null;
	replaced_stop: boolean;
	osm_station_id: number | null;
	platform_info: unknown | null;
}

export interface TripIntroductionInformation {
	stoptimes: StopTimeIntroduction[];
	tz: string;
	block_id: string | null;
	bikes_allowed: number;
	wheelchair_accessible: number;
	has_frequencies: boolean;
	route_id: string;
	agency_id: string;
	agency_name: string;
	trip_headsign: string | null;
	route_short_name: string | null;
	trip_short_name: string | null;
	route_long_name: string | null;
	color: string | null;
	text_color: string | null;
	vehicle: AspenisedVehicleDescriptor | null;
	route_type: number;
	stop_id_to_alert_ids: Record<string, string[]>;
	alert_id_to_alert: Record<string, AspenisedAlert>;
	alert_ids_for_this_route: string[];
	alert_ids_for_this_trip: string[];
	shape_polyline: string | null;
	trip_id_found_in_db: boolean;
	service_date: IsoDateString | null;
	schedule_trip_exists: boolean;
	rt_shape: boolean;
	old_shape_polyline: string | null;
	cancelled_stoptimes: StopTimeIntroduction[];
	is_cancelled: boolean;
	deleted: boolean;
	connecting_routes: Record<string, Record<string, PostgresRoute>> | null;
	connections_per_stop: Record<string, Record<string, string[]>> | null;
	trip_id: string | null;
	chateau: string | null;
	consist: unknown | null;
	sbb_formation: unknown | null;
}

export type RamondaClientMessage =
	| ({ type: 'subscribe_trip'; chateau: string } & QueryTripInformationParams)
	| ({ type: 'unsubscribe_trip'; chateau: string } & QueryTripInformationParams)
	| { type: 'unsubscribe_all_trips' }
	| { type: 'ping' };

export type RamondaServerMessage =
	| { type: 'initial_trip'; data: TripIntroductionInformation }
	| { type: 'update_trip'; data: GtfsRtRefreshData }
	| { type: 'error'; message: string }
	| { type: 'pong' };

export function isRamondaServerMessage(value: unknown): value is RamondaServerMessage {
	if (!isRecord(value) || typeof value.type !== 'string') return false;

	switch (value.type) {
		case 'initial_trip':
			return isRecord(value.data) && Array.isArray(value.data.stoptimes);
		case 'update_trip':
			return isRecord(value.data) && Array.isArray(value.data.stoptimes);
		case 'error':
			return typeof value.message === 'string';
		case 'pong':
			return true;
		default:
			return false;
	}
}
