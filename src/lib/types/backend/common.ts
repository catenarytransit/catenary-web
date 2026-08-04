/**
 * Shared wire types copied from catenary-backend.
 *
 * Keep database-backed models and Aspen/GTFS-RT value objects here so that
 * service-specific protocol modules can depend on one canonical definition.
 * Rust `Option<T>` fields are represented as `T | null` because Serde emits
 * explicit JSON nulls for these structs.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type IsoDateString = string;
export type GtfsDateString = string;
export type UnixSeconds = number;
export type UnixMilliseconds = number;

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/** Mirrors `catenary::models::Route`. */
export interface PostgresRoute {
	onestop_feed_id: string;
	attempt_id: string;
	route_id: string;
	short_name: string | null;
	short_name_translations: JsonValue | null;
	long_name: string | null;
	long_name_translations: JsonValue | null;
	gtfs_desc: string | null;
	gtfs_desc_translations: JsonValue | null;
	route_type: number;
	url: string | null;
	url_translations: JsonValue | null;
	agency_id: string | null;
	gtfs_order: number | null;
	color: string | null;
	text_color: string | null;
	continuous_pickup: number;
	continuous_drop_off: number;
	shapes_list: Array<string | null> | null;
	chateau: string;
}

/** Mirrors the serialisable fields of `catenary::models::Agency`. */
export interface PostgresAgency {
	static_onestop_id: string;
	agency_id: string;
	attempt_id: string;
	agency_name: string;
	agency_name_translations: JsonValue | null;
	agency_url: string;
	agency_url_translations: JsonValue | null;
	agency_timezone: string;
	agency_lang: string | null;
	agency_phone: string | null;
	agency_fare_url: string | null;
	agency_fare_url_translations: JsonValue | null;
	chateau: string;
	unified_agency_id: string | null;
	level_0s: Array<string | null> | null;
	level_1s: Array<string | null> | null;
	has_rail: boolean;
	has_tram: boolean;
	has_metro: boolean;
	has_ferry: boolean;
	has_bus: boolean;
}

/** Mirrors `catenary::models::BasicVehicleHistory`. */
export interface PostgresBasicVehicleHistory {
	realtime_feed_id: string;
	chateau: string;
	route_id: string;
	agency_id: string | null;
	unified_agency_id: string | null;
	vehicle_label: string;
	trip_id: string;
	block_id: string | null;
	operation_date: IsoDateString;
}

/** Mirrors `catenary::models::BasicVehicle`. */
export interface PostgresBasicVehicle {
	unified_agency_id: string;
	vehicle_label: string;
	trip_id: string | null;
	block_id: string | null;
	model: string | null;
	manufacturer: string | null;
	manufacture_year: number | null;
}

export interface AspenisedVehicleDescriptor {
	id: string | null;
	label: string | null;
	license_plate: string | null;
	wheelchair_accessible: number | null;
}

export interface CatenaryRtVehiclePosition {
	latitude: number;
	longitude: number;
	bearing: number | null;
	odometer: number | null;
	speed: number | null;
}

export type AspenisedTripScheduleRelationship =
	| 'Scheduled'
	| 'Added'
	| 'Unscheduled'
	| 'Cancelled'
	| 'Replacement'
	| 'Duplicated'
	| 'Deleted';

export interface AspenisedVehicleTripInfo {
	trip_id: string | null;
	trip_headsign: string | null;
	route_id: string | null;
	trip_short_name: string | null;
	direction_id: number | null;
	start_time: string | null;
	start_date: IsoDateString | null;
	schedule_relationship: AspenisedTripScheduleRelationship | null;
	delay: number | null;
}

/** Vehicle position returned by Aspen/Birch endpoints. */
export interface AspenisedVehiclePosition {
	trip: AspenisedVehicleTripInfo | null;
	vehicle: AspenisedVehicleDescriptor | null;
	position: CatenaryRtVehiclePosition | null;
	timestamp: UnixSeconds | null;
	route_type: number;
	current_stop_sequence: number | null;
	current_status: number | null;
	congestion_level: number | null;
	occupancy_status: number | null;
	occupancy_percentage: number | null;
	consist: unknown | null;
}

/** The smaller map payload emitted by Spruce's `convert_to_output`. */
export interface AspenisedVehicleTripInfoOutput {
	trip_id: string | null;
	trip_headsign: string | null;
	route_id: string | null;
	trip_short_name: string | null;
	direction_id: number | null;
	start_time: string | null;
	start_date: GtfsDateString | null;
	schedule_relationship: number | null;
	delay: number | null;
}

export interface AspenisedVehiclePositionOutput {
	trip: AspenisedVehicleTripInfoOutput | null;
	vehicle: AspenisedVehicleDescriptor | null;
	position: CatenaryRtVehiclePosition | null;
	timestamp: UnixSeconds | null;
	route_type: number;
	current_stop_sequence: number | null;
	current_status: number | null;
	congestion_level: number | null;
	occupancy_status: number | null;
	occupancy_percentage: number | null;
}

export type PositionedVehicle = AspenisedVehiclePositionOutput & {
	position: CatenaryRtVehiclePosition;
};

export interface AspenisedVehicleRouteCache {
	route_short_name: string | null;
	route_long_name: string | null;
	route_colour: string | null;
	route_text_colour: string | null;
	route_type: number;
	route_desc: string | null;
	agency_id: string | null;
}


export interface AspenStopTimeEvent {
	delay: number | null;
	time: UnixSeconds | null;
	uncertainty: number | null;
}

export interface AspenTimeRange {
	start: UnixSeconds | null;
	end: UnixSeconds | null;
}

export interface AspenRawTripInfo {
	trip_id: string | null;
	route_id: string | null;
	direction_id: number | null;
	start_time: string | null;
	start_date: IsoDateString | null;
	schedule_relationship: AspenisedTripScheduleRelationship | null;
	modified_trip: {
		modifications_id: string | null;
		affected_trip_id: string | null;
	} | null;
}

export interface AspenEntitySelector {
	agency_id: string | null;
	route_id: string | null;
	route_type: number | null;
	trip: AspenRawTripInfo | null;
	stop_id: string | null;
	direction_id: number | null;
}

export interface AspenTranslation {
	text: string;
	language: string | null;
}

export interface AspenTranslatedString {
	translation: AspenTranslation[];
}

export interface AspenLocalisedImage {
	url: string;
	media_type: string;
	language: string | null;
}

export interface AspenTranslatedImage {
	localised_image: AspenLocalisedImage[];
}

export interface AspenisedAlert {
	active_period: AspenTimeRange[];
	informed_entity: AspenEntitySelector[];
	cause: number | null;
	effect: number | null;
	url: AspenTranslatedString | null;
	header_text: AspenTranslatedString | null;
	description_text: AspenTranslatedString | null;
	tts_header_text: AspenTranslatedString | null;
	tts_description_text: AspenTranslatedString | null;
	severity_level: number | null;
	image: AspenTranslatedImage | null;
	image_alternative_text: AspenTranslatedString | null;
	cause_detail: AspenTranslatedString | null;
	effect_detail: AspenTranslatedString | null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
