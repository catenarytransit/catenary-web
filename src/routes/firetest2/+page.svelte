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
			style: '/light-style.json', // stylesheet location
			center: [-118, 34], // starting position [lng, lat]
			zoom: 10 // starting zoom
		});

		map.on('load', () => {
			map.setProjection({ type: 'globe' });

			console.log(map);

			const evacuation_fire_url =
				'https://fireboundscache.catenarymaps.org/data/evac_california.json';

			map.addSource('evacuation_ca_fire', {
				type: 'geojson',
				data: evacuation_fire_url
			});

			map.addLayer({
				source: 'evacuation_ca_fire',
				id: 'evacuation_ca_fire_bounds',
				type: 'fill',
				paint: {
					'fill-color': [
						'case',
						['==', ['get', 'Label'], 'Mandatory'],
						'#dd3300',
						['==', ['get', 'Label'], 'Warning'],
						'#cc9900',
						'#ff0000'
					],
					'fill-opacity': 0.4
				},
				minzoom: 5
			});
		});
	});
</script>

<div class="w-full">
	<div id="map" class="fixed top-0 left-0 w-[100vw] h-[100vh]" />
</div>
