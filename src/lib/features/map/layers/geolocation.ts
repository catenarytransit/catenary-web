import type maplibregl from 'maplibre-gl';

export function addGeolocationSourceAndBearingLayer(map: maplibregl.Map): void {
	if (!map.getSource('user_geolocation')) {
		map.addSource('user_geolocation', {
			type: 'geojson',
			data: {
				type: 'FeatureCollection',
				features: [
					{
						type: 'Feature',
						geometry: { type: 'Point', coordinates: [0, 0] },
						properties: {}
					}
				]
			}
		});
	}

	if (!map.getLayer('bearing_position')) {
		map.addLayer({
			id: 'bearing_position',
			type: 'symbol',
			source: 'user_geolocation',
			layout: {
				'icon-image': 'geonav',
				'icon-size': 0.13,
				'icon-rotate': ['get', 'heading'],
				visibility: 'none'
			},
			paint: { 'icon-opacity': 0.8 }
		});
	}
}

export function addGeolocationFallbackLayer(map: maplibregl.Map): void {
	if (map.getLayer('nobearing_position')) {
		return;
	}

	map.addLayer({
		id: 'nobearing_position',
		type: 'symbol',
		source: 'user_geolocation',
		layout: {
			'icon-image': 'geocircle',
			'icon-size': 0.1,
			visibility: 'none',
			'icon-allow-overlap': true,
			'icon-ignore-placement': true,
			'text-allow-overlap': true,
			'text-ignore-placement': true
		},
		paint: { 'icon-opacity': 0.8 }
	});
}
