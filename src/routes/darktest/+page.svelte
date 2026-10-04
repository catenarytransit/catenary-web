<script lang="ts">
	import * as maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import type { ProjectionSpecification } from 'maplibre-gl';

	import { onMount } from 'svelte';

	onMount(() => {
		const map = new maplibregl.Map({
			container: 'map',
			hash: 'pos',
			pixelRatio: window.devicePixelRatio * 1.4,
			style: '/dark-style.json', // stylesheet location
			center: [-74.5, 40], // starting position [lng, lat]
			zoom: 9 // starting zoom
		});

		map.on('load', () => {
			map.setProjection({ type: 'globe' });

			map.addSource('hillshade', {
				type: 'raster-dem',
				url: 'https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=B265xPhJaYe2kWHOLHTG'
			});

			map.addLayer(
				{
					id: 'hillshade',
					type: 'hillshade',
					source: 'hillshade',

					paint: {
						'hillshade-shadow-color': '#050511',
						'hillshade-highlight-color': '#333333',
						'hillshade-accent-color': '#aaaaaa'
					},
					layout: {}
				},
				'aeroway_fill'
			);

			console.log(map);
		});
	});
</script>

<div class="w-full">
	<div id="map" class="fixed top-0 left-0 w-[100vw] h-[100vh]" />
</div>
