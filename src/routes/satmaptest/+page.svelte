<script lang="ts">
	import maplibregl from 'maplibre-gl';
	import { onMount } from 'svelte';
	import { addShapes } from '../../components/addLayers/addShapes';

	let centerinit: [number, number] = [-118, 33.9];
	let zoominit = 8.1;

	onMount(() => {
		if (navigator.hardwareConcurrency > 8) {
			maplibregl.setWorkerCount(8);
		} else {
			maplibregl.setWorkerCount(4);
		}

		const map = new maplibregl.Map({
			canvasContextAttributes: {
				antialias: true,
				powerPreference: 'high-performance',
				//     failIfMajorPerformanceCaveat: true,
				desynchronized: true,
				//preserveDrawingBuffer: true,
				contextType: 'webgl2'
			},
			container: 'map',
			//	hash: 'pos',

			//	antialias: true,
			style: '/sat-v2.json', // stylesheet location
			center: centerinit, // starting position [lng, lat]
			//keep the centre at Los Angeles, since that is our primary user base currently
			//switch to IP geolocation and on the fly rendering for this soon
			zoom: zoominit, // starting zoom (must be greater than 8.1)
			fadeDuration: 0
		});
	});
</script>

<title>Catenary Maps - Sat map test</title>

<div id="map" class="fixed top-0 left-0 w-[100vw] h-[100vh]" />
