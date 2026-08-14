export type MotisLocationType = 'ADDRESS' | 'PLACE' | 'STOP';

/** [start index, length] for a portion of the query matched by MOTIS. */
export type MotisToken = [start: number, length: number];

export interface MotisArea {
	name: string;
	adminLevel: number;
	matched: boolean;
	unique: boolean;
	default: boolean;
}

export type MotisMode =
	| 'WALK'
	| 'BIKE'
	| 'RENTAL'
	| 'CAR'
	| 'CAR_PARKING'
	| 'CAR_DROPOFF'
	| 'ODM'
	| 'RIDE_SHARING'
	| 'FLEX'
	| 'DEBUG_BUS_ROUTE'
	| 'DEBUG_RAILWAY_ROUTE'
	| 'DEBUG_FERRY_ROUTE'
	| 'TRANSIT'
	| 'TRAM'
	| 'SUBWAY'
	| 'FERRY'
	| 'AIRPLANE'
	| 'BUS'
	| 'COACH'
	| 'RAIL'
	| 'HIGHSPEED_RAIL'
	| 'LONG_DISTANCE'
	| 'NIGHT_RAIL'
	| 'REGIONAL_FAST_RAIL'
	| 'REGIONAL_RAIL'
	| 'SUBURBAN'
	| 'FUNICULAR'
	| 'AERIAL_LIFT'
	| 'OTHER'
	| 'AREAL_LIFT'
	| 'METRO'
	| 'CABLE_CAR';

export interface MotisGeocodeMatch {
	type: MotisLocationType;
	category?: string;
	tokens: MotisToken[];
	name: string;
	id: string;
	lat: number;
	lon: number;
	level?: number;
	street?: string;
	houseNumber?: string;
	country?: string;
	zip?: string;
	tz?: string;
	areas: MotisArea[];
	score: number;
	modes?: MotisMode[];
	importance?: number;
}

export type MotisGeocodeResponse = MotisGeocodeMatch[];

export type MotisAddressOrPlaceMatch = MotisGeocodeMatch & {
	type: 'ADDRESS' | 'PLACE';
};

export type MotisAddressOrPlaceResponse = MotisAddressOrPlaceMatch[];
