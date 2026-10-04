<script lang="ts">
	import * as maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import type { ProjectionSpecification } from 'maplibre-gl';

	import { onMount } from 'svelte';

	onMount(() => {
		if (navigator.hardwareConcurrency > 8) {
			maplibregl.setWorkerCount(8);
		} else {
			maplibregl.setWorkerCount(4);
		}

		const map = new maplibregl.Map({
			canvasContextAttributes: {
				antialias: false,
				powerPreference: 'high-performance',
				desynchronized: false,
				contextType: 'webgl2'
			},
			container: 'map',
			// localIdeographFontFamily: false,
			hash: 'pos',
			//	pixelRatio: window.devicePixelRatio * 1.5,
			//	maxPitch: window.innerHeight / window.innerWidth > 1.5 ? 60 : 85,
			//	validateStyle: true,
			//	fadeDuration: 100,
			style: 'https://api.maptiler.com/maps/streets-v4/style.json?key=tf30gb2F4vIsBW5k9Msd', // stylesheet location
			center: [11.575, 48.1375], // starting position [lng, lat]
			zoom: 13 // starting zoom (must be greater than 8.1)
		});

		map.on('load', () => {
			map.setProjection({ type: 'globe' });

			console.log(map);
		});
	});
</script>

<div class="w-full">
	<div id="map" class="fixed top-0 left-0 w-[100vw] h-[100vh]" />
</div>
