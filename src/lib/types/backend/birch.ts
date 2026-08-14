import type {
	AspenisedVehiclePosition,
	IsoDateString,
	PostgresRoute,
	UnixSeconds
} from './common';

export interface ResponseForGtfsVehicle {
	found_data: boolean;
	data: AspenisedVehiclePosition[] | null;
}

export interface VehicleHistoryLookupQuery {
	vehicle?: string;
	chateau?: string;
	route_id?: string;
	unified_agency_id?: string;
	start_date?: IsoDateString;
	end_date?: IsoDateString;
}

export interface RouteHistoryRow {
	operation_date: IsoDateString;
	unix_start_time: UnixSeconds | null;
	trip_id: string;
	route_id: string;
	trip_short_name: string | null;
	direction_headsign: string | null;
	block_id: string | null;
}

export interface VehicleHistoryLookupResponse {
	trip_history: RouteHistoryRow[];
	routes: Record<string, PostgresRoute>;
	agency_timezone: string;
	agency_name: string;
}

export interface VehicleHistoryOfRouteRow {
	operation_date: IsoDateString;
	vehicle_label: string;
	trip_id: string;
	trip_short_name: string | null;
	direction_headsign: string | null;
	block_id: string | null;
}

export interface VehicleHistoryOfRouteResponse {
	trip_history: VehicleHistoryOfRouteRow[];
	agency_timezone: string;
	agency_name: string;
}

export interface BirchErrorResponse {
	error: {
		code: 'bad_request' | 'not_found' | 'conflict' | 'database_error' | 'internal_error' | string;
		message: string;
	};
}

export type BirchRoutesByAgencyResponse = PostgresRoute[];
