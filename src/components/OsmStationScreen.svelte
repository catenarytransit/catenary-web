<script lang="ts">
	import GenericStopScreen from './GenericStopScreen.svelte';
	export let osm_id: string;
	export let stationName: string | null = null;
	export let stationLat: number | null = null;
	export let stationLon: number | null = null;
	export let initial_is_now: boolean = true;
	export let initial_selected_unix_time: number = Date.now() / 1000;

	$: buildUrl = (startSec: number, endSec: number) => {
		const base = 'https://birch.catenarymaps.org/departures_at_osm_station';
		const params = new URLSearchParams({
			osm_station_id: osm_id,
			greater_than_time: String(startSec),
			less_than_time: String(endSec),
			include_shapes: String(false)
		});
		return `${base}?${params.toString()}`;
	};
</script>

<GenericStopScreen {buildUrl} key={osm_id} {stationName} {stationLat} {stationLon} {initial_is_now} {initial_selected_unix_time} />
