// TODO
export type PlatformSectorDefinition = any;
export type AspenisedVehicleDescriptor = any;
export type AspenisedAlert = any;
export type UnifiedConsist = any;
export type NearbyDeparturesChunk = any;

type String = string;
type EcoString = string;
type CompactString = string;
type BTreeMap<K extends keyof any, T> = Record<K, T>;
type u8 = number;
type u16 = number;
type u32 = number;
type u64 = number;
type i8 = number;
type i16 = number;
type i32 = number;
type i64 = number;
type f64 = number;
type bool = boolean;
type Vec<T> = Array<T>;

type Tz = any;
type NaiveDate = any;

type Option<T> = T | null;

// catenary-backend/src/models.rs
export interface Route {
	onestop_feed_id: String,
	attempt_id: String,
	route_id: String,
	short_name: Option<String>,
	short_name_translations: Option<any>,
	long_name: Option<String>,
	long_name_translations: Option<any>,
	gtfs_desc: Option<String>,
	gtfs_desc_translations: Option<any>,
	route_type: i16,
	url: Option<String>,
	url_translations: Option<any>,
	agency_id: Option<String>,
	gtfs_order: Option<u32>,
	color: Option<String>,
	text_color: Option<String>,
	continuous_pickup: i16,
	continuous_drop_off: i16,
	shapes_list: Option<Vec<Option<String>>>,
	chateau: String,
}

// catenary-backend/src/aspen_dataset.rs
export interface AspenStopTimeEvent {
	delay?: number,
	time?: number,
	uncertainty?: number,
}

// catenary-backend/src/trip_logic.rs
export interface GtfsRtRefreshData {
	stoptimes: Vec<StopTimeRefresh>,
	timestamp: Option<u64>,
	trip_id: Option<String>,
	chateau: Option<String>,
}

// catenary-backend/src/trip_logic.rs
export interface StopTimeRefresh {
	stop_id: Option<EcoString>,
	rt_arrival: Option<AspenStopTimeEvent>,
	rt_departure: Option<AspenStopTimeEvent>,
	schedule_relationship: Option<u8>,
	gtfs_stop_sequence: Option<u16>,
	rt_platform_string: Option<EcoString>,
	departure_occupancy_status: Option<u8>,
	platform_info: Option<AspenisedPlatformInfo>,
}

export interface AspenisedPlatformInfo {
	/// SIRI: AimedQuayName | DB: departurePlatformSchedule
	aimed: Option<EcoString>,

	/// SIRI: ExpectedQuayName | DB: departurePlatform
	expected: Option<EcoString>,

	/// Full sector map of the platform (DB: platform.sectors)
	/// Used to draw the platform in the UI independently of the train.
	platform_sectors: Option<Vec<PlatformSectorDefinition>>,

	is_changed: bool,
}

// catenary-backend/src/trip_logic.rs
export interface StopTimeIntroduction {
	stop_id: CompactString,
	name: Option<String>,
	translations: Option<BTreeMap<String, String>>,
	platform_code: Option<String>,
	rt_platform_string: Option<String>,
	timezone: Option<Tz>,
	code: Option<String>,
	longitude: Option<f64>,
	latitude: Option<f64>,
	scheduled_arrival_time_unix_seconds: Option<u64>,
	scheduled_departure_time_unix_seconds: Option<u64>,
	rt_arrival: Option<AspenStopTimeEvent>,
	rt_departure: Option<AspenStopTimeEvent>,
	schedule_relationship: Option<u8>,
	gtfs_stop_sequence: Option<u16>,
	interpolated_stoptime_unix_seconds: Option<u64>,
	timepoint: Option<bool>,
	replaced_stop: bool,
	osm_station_id: Option<i64>,
	platform_info: Option<AspenisedPlatformInfo>,
}

// catenary-backend/src/trip_logic.rs
export interface TripIntroductionInformation {
	stoptimes: Vec<StopTimeIntroduction>,
	tz: Tz,
	block_id: Option<String>,
	bikes_allowed: i16,
	wheelchair_accessible: i16,
	has_frequencies: bool,
	route_id: String,
	trip_headsign: Option<String>,
	route_short_name: Option<String>,
	trip_short_name: Option<String>,
	route_long_name: Option<String>,
	color: Option<String>,
	text_color: Option<String>,
	vehicle: Option<AspenisedVehicleDescriptor>,
	route_type: i16,
	stop_id_to_alert_ids: BTreeMap<String, Vec<String>>,
	alert_id_to_alert: BTreeMap<String, AspenisedAlert>,
	alert_ids_for_this_route: Vec<String>,
	alert_ids_for_this_trip: Vec<String>,
	shape_polyline: Option<String>,
	trip_id_found_in_db: bool,
	service_date: Option<NaiveDate>,
	schedule_trip_exists: bool,
	rt_shape: bool,
	old_shape_polyline: Option<String>,
	cancelled_stoptimes: Vec<StopTimeIntroduction>,
	is_cancelled: bool,
	deleted: bool,
	connecting_routes: Option<BTreeMap<String, BTreeMap<String, Route>>>, // chateau -> route_id -> Route
	connections_per_stop: Option<BTreeMap<String, BTreeMap<String, Vec<String>>>>, // stop_id -> chateau -> route_ids
	trip_id: Option<String>,
	chateau: Option<String>,
	consist: Option<UnifiedConsist>,
}
