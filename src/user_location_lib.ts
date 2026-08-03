import { get } from 'svelte/store';
import { createGeoJSONCircle } from './geoMathsAssist';
import { setUserCircles } from './components/userradius';
import { saveLocationToLocalStorage } from './components/previously_known_location';
import {
	geolocation_store,
	map_pointer_store,
	show_my_location_store,
	usunits_store
} from './globalstores';

export const permission_to_geolocate = 'permission_to_geolocate';

let last_processed_state = '';

export function start_location_watch(): (() => void) | undefined {
	if (
		typeof navigator === 'undefined' ||
		typeof window === 'undefined' ||
		!('geolocation' in navigator)
	) {
		return undefined;
	}

	last_processed_state = '';

	const success = (position: GeolocationPosition) => {
		geolocation_store.set(position);
		update_geolocation_source();
	};

	const refreshInterval = window.setInterval(update_geolocation_source, 1000);
	const watchId = navigator.geolocation.watchPosition(success, () => {}, {
		enableHighAccuracy: false,
		timeout: 5000,
		maximumAge: Infinity
	});

	return () => {
		last_processed_state = '';
		window.clearInterval(refreshInterval);
		navigator.geolocation.clearWatch(watchId);
	};
}

export function has_permission_to_geolocate(): boolean {
	const check = window.localStorage.getItem(permission_to_geolocate);

	if (check == null) {
		return false;
	} else {
		if (check == 'true') {
			return true;
		} else {
			return false;
		}
	}
}

export function ask_for_user_location_permission() {}

export function update_geolocation_source() {
	//	console.log('updating geolocation source');

	const map = get(map_pointer_store);

	if (map != null) {
		const geolocation = get(geolocation_store);

		if (geolocation?.coords) {
			saveLocationToLocalStorage({
				time: Date.now(),
				latitude: geolocation?.coords.latitude,
				longitude: geolocation?.coords.longitude
			});
		}

		const show_my_location = get(show_my_location_store);
		const usunits = get(usunits_store) || false;

		const geolocation_mapsource = map.getSource('user_geolocation') as maplibregl.GeoJSONSource;

		if (geolocation_mapsource) {
			if (geolocation && geolocation.coords) {
				const currentState = JSON.stringify({
					lng: geolocation.coords.longitude,
					lat: geolocation.coords.latitude,
					acc: geolocation.coords.accuracy,
					heading: geolocation.coords.heading,
					show: show_my_location,
					units: usunits
				});

				if (currentState !== last_processed_state) {
					last_processed_state = currentState;

					geolocation_mapsource.setData({
						type: 'FeatureCollection',
						features: [
							{
								type: 'Feature',
								geometry: {
									type: 'Point',
									coordinates: [geolocation.coords.longitude, geolocation.coords.latitude]
								},
								properties: {
									accuracy: geolocation.coords.accuracy,
									heading: geolocation.coords.heading
								}
							}
						]
					});

					setUserCircles(map, geolocation.coords.longitude, geolocation.coords.latitude);

					if (geolocation.coords.accuracy) {
						let accuracyLayer = map.getSource('userpositionacc') as maplibregl.GeoJSONSource;

						if (accuracyLayer) {
							let numberofpoints: number = 128;

							let geojsondata: any = createGeoJSONCircle(
								[geolocation.coords.longitude, geolocation.coords.latitude],
								geolocation.coords.accuracy / 1000,
								numberofpoints
							);

							geojsondata.features[0].properties.opacity = 0.2;

							if (geolocation.coords.accuracy >= 1000) {
								geojsondata.features[0].properties.opacity = 0.05;
							}

							if (geolocation.coords.accuracy >= 2000) {
								geojsondata.features[0].properties.opacity = 0.02;
							}

							if (geolocation.coords.accuracy >= 5000) {
								geojsondata.features[0].properties.opacity = 0.01;
							}

							accuracyLayer.setData(
								geojsondata,
								geolocation.coords.longitude,
								geolocation.coords.latitude
							);
						}
					}

					let nobearingposlayer = map.getLayer('nobearing_position');
					let bearingposlayer = map.getLayer('bearing_position');

					const setVisSafe = (layerId: string, vis: 'visible' | 'none') => {
						if (map.getLayer(layerId) && map.getLayoutProperty(layerId, 'visibility') !== vis) {
							map.setLayoutProperty(layerId, 'visibility', vis);
						}
					};

					if (geolocation.coords.heading) {
						// console.log('bearing is', geolocation.coords.heading);

						if (show_my_location) {
							setVisSafe('nobearing_position', 'none');
							setVisSafe('bearing_position', 'visible');
						} else {
							setVisSafe('bearing_position', 'none');
							setVisSafe('nobearing_position', 'none');
						}
					} else {
						if (show_my_location) {
							setVisSafe('nobearing_position', 'visible');
						} else {
							setVisSafe('nobearing_position', 'none');
						}
						setVisSafe('bearing_position', 'none');
					}
				}
			}
		}
	} else {
		console.log('no map for geolocation');
	}
}
