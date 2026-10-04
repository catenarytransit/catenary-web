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
			style: 'https://tiles.openfreemap.org/styles/liberty', // stylesheet location
			center: [-74.5, 40], // starting position [lng, lat]
			zoom: 9 // starting zoom
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
