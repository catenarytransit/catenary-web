import {
	BlockStack,
	OsmItemStack,
	OsmStationStack,
	RouteStack,
	SingleTrip,
	StackInterface,
	StopStack
} from '../components/stackenum';

import {
	data_stack_store,
	nearby_pick_state_store,
	nearby_user_picks_store
} from '../globalstores';

function getFirstParam(urlParams: URLSearchParams, ...names: string[]): string | null {
	for (const name of names) {
		const value = urlParams.get(name);
		if (value !== null) return value;
	}
	return null;
}

function getOptionalNumber(urlParams: URLSearchParams, ...names: string[]): number | null {
	const value = getFirstParam(urlParams, ...names);
	if (value === null || value.trim() === '') return null;

	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function getOptionalBoolean(urlParams: URLSearchParams, ...names: string[]): boolean | undefined {
	const value = getFirstParam(urlParams, ...names);
	if (value === null) return undefined;
	if (value === 'true' || value === '1') return true;
	if (value === 'false' || value === '0') return false;
	return undefined;
}

export function deep_link_url_reader() {
	if (typeof window === 'undefined') return;

	const urlParams = new URLSearchParams(window.location.search);
	const page = getFirstParam(urlParams, 'page', 'screen');
	if (!page) return;

	if (page === 'nearby' || page === 'nearby_departures') {
		const lat = getOptionalNumber(urlParams, 'lat');
		const lon = getOptionalNumber(urlParams, 'lon');

		if (lat !== null && lon !== null) {
			nearby_user_picks_store.set({ latitude: lat, longitude: lon });
			nearby_pick_state_store.set(1);
		}
		return;
	}

	let nextStack: StackInterface | null = null;

	if (page === 'route') {
		const chateau = getFirstParam(urlParams, 'chateau');
		const routeId = getFirstParam(urlParams, 'route', 'route_id');

		if (chateau && routeId) {
			nextStack = new StackInterface(new RouteStack(chateau, routeId));
		}
	}

	if (page === 'trip') {
		const chateau = getFirstParam(urlParams, 'chateau');
		const tripId = getFirstParam(urlParams, 'trip', 'trip_id');
		const vehicleId = getFirstParam(urlParams, 'vehicle');

		if (chateau && (tripId || vehicleId)) {
			nextStack = new StackInterface(
				new SingleTrip(
					chateau,
					tripId,
					getFirstParam(urlParams, 'route', 'route_id'),
					getFirstParam(urlParams, 'start_time'),
					getFirstParam(urlParams, 'start_date'),
					vehicleId,
					getOptionalNumber(urlParams, 'route_type')
				)
			);
		}
	}

	if (page === 'stop') {
		const chateau = getFirstParam(urlParams, 'chateau');
		const stopId = getFirstParam(urlParams, 'stop', 'stop_id');

		if (chateau && stopId) {
			nextStack = new StackInterface(
				new StopStack(
					chateau,
					stopId,
					getOptionalBoolean(urlParams, 'is_now'),
					getOptionalNumber(urlParams, 'time') ?? undefined
				)
			);
		}
	}

	if (page === 'osm_departures' || page === 'osm_station') {
		const osmId = getFirstParam(urlParams, 'osm_id');

		if (osmId) {
			nextStack = new StackInterface(
				new OsmStationStack(
					osmId,
					getFirstParam(urlParams, 'name'),
					getFirstParam(urlParams, 'mode'),
					getOptionalNumber(urlParams, 'lat'),
					getOptionalNumber(urlParams, 'lon'),
					getOptionalBoolean(urlParams, 'is_now'),
					getOptionalNumber(urlParams, 'time') ?? undefined
				)
			);
		}
	}

	if (page === 'block') {
		const chateau = getFirstParam(urlParams, 'chateau');
		const blockId = getFirstParam(urlParams, 'block', 'block_id');
		const serviceDate = getFirstParam(urlParams, 'service_date');

		if (chateau && blockId && serviceDate) {
			nextStack = new StackInterface(new BlockStack(chateau, blockId, serviceDate));
		}
	}

	if (page === 'osm_item') {
		const osmId = getFirstParam(urlParams, 'osm_id');
		const osmClass = getFirstParam(urlParams, 'osm_class');

		if (osmId && osmClass) {
			nextStack = new StackInterface(
				new OsmItemStack(osmId, osmClass, getFirstParam(urlParams, 'osm_type'))
			);
		}
	}

	if (nextStack) {
		data_stack_store.set([nextStack]);
	}
}
