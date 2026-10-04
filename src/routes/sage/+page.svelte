<script lang="ts">
	import * as maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import type { ProjectionSpecification } from 'maplibre-gl';

	import { buffer, union } from '@turf/turf';

	import { onMount } from 'svelte';

	import { determineDarkModeToBool } from '../../components/determineDarkModeToBool';

	onMount(() => {
		let darkMode = determineDarkModeToBool();

		let style = darkMode ? '/dark-style.json' : '/light-style.json';

		const map = new maplibregl.Map({
			container: 'map',
			hash: 'pos',
			pixelRatio: window.devicePixelRatio * 1.4,
			style: style, // stylesheet location
			center: [-119.509444, 37.229722], // starting position [lng, lat]
			zoom: 5.5 // starting zoom
		});

		map.on('load', () => {
			fetch(
				'https://gist.githubusercontent.com/kylerchin/0d91c3652d9546d0dfdf77d90ba03820/raw/009e4b4762210ce5abf6e576bf208cdad43d1e65/rail_stops_query_filtered.json'
			)
				.then((response) => response.json())
				.then((data) => {
					console.log(data);

					//array input looks like
					// [
					//     {
					//         "name": "Los Angeles",
					//         "chateau": "amtrak",
					//         "point": {
					//             x: -118.2437,
					//             y: 34.0522
					//         }
					//     },
					//  ]

					//mapbox expects geojson input

					//convert array to geojson

					let geojson = {
						type: 'FeatureCollection',
						features: []
					};

					let buffered_geojson = {
						type: 'FeatureCollection',
						features: []
					};

					data.forEach((element) => {
						let feature = {
							type: 'Feature',
							properties: {
								name: element.name,
								chateau: element.chateau
							},
							geometry: {
								type: 'Point',
								coordinates: [element.point.x, element.point.y]
							}
						};

						geojson.features.push(feature);

						//buffer each point into a circle by 804.672 meters using turf.js

						buffered_geojson.features.push(buffer(feature, 804.672, { units: 'meters' }));
					});

					//merge buffered features into a single multipolygon via union

					const buffered_geojson_merged = union(buffered_geojson);

					console.log(buffered_geojson_merged);

					map.addSource('combined_area', {
						type: 'geojson',
						data: {
							type: 'FeatureCollection',
							features: [buffered_geojson_merged]
						}
					});

					map.addSource('rail-stops', {
						type: 'geojson',
						data: buffered_geojson
					});

					map.addLayer({
						id: 'rail-stops',
						type: 'fill',
						source: 'combined_area',
						paint: {
							'fill-color': '#088',
							'fill-opacity': 0.2
						}
					});

					//draw perim

					map.addLayer({
						id: 'rail-stops-perim',
						type: 'line',
						source: 'rail-stops',
						paint: {
							'line-color': '#088',
							'line-width': 1.5,
							'line-opacity': 0.1
						}
					});

					map.addLayer({
						id: 'rail-stops-perim-2',
						type: 'line',
						source: 'combined_area',
						paint: {
							'line-color': '#088',
							'line-width': 2,
							'line-opacity': 1
						}
					});
				});

			console.log(map);
		});
	});
</script>

<div class="w-full">
	<div id="map" class="fixed top-0 left-0 w-[100vw] h-[100vh]" />
</div>
