// catenary-backend/src/models.rs Route
export interface Route {
	onestop_feed_id?: string;
	attempt_id?: string;
	route_id?: string;
	short_name?: string;
	short_name_translations?: any;
	long_name?: string;
	long_name_translations?: any;
	gtfs_desc?: string;
	gtfs_desc_translations?: any;
	route_type?: number;
	url?: string;
	url_translations?: any;
	agency_id?: string;
	gtfs_order?: number;
	color?: string;
	text_color?: string;
	continuous_pickup?: number;
	continuous_drop_off?: number;
	shapes_list?: any;
	chateau?: string;
}