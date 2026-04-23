<script lang="ts">
	import GenericStopScreen from './GenericStopScreen.svelte';
	import { data_stack_store } from '../globalstores';
	import { StackInterface, OsmStationStack } from './stackenum';

	export let chateau: string;
	export let stop_id: string;
	export let initial_is_now: boolean = true;
	export let initial_selected_unix_time: number = Date.now() / 1000;

	$: buildUrl = (startSec: number, endSec: number) => {
		const base = 'https://birchdeparturesfromstop.catenarymaps.org/departures_at_stop';
		const params = new URLSearchParams({
			stop_id,
			chateau_id: chateau,
			greater_than_time: String(startSec),
			less_than_time: String(endSec),
			include_shapes: String(false)
		});
		return `${base}?${params.toString()}`;
	};

	const checkOsmStation = async () => {
		try {
			const res = await fetch(
				`https://birch.catenarymaps.org/osm_station_lookup?chateau_id=${chateau}&gtfs_stop_id=${stop_id}`
			);
			const data = await res.json();
			if (data.found && data.osm_station_id) {
				data_stack_store.update((stack) => {
					const newStackItem = new StackInterface(
						new OsmStationStack(
							String(data.osm_station_id),
							data.osm_station_info?.name || null,
							data.osm_station_info?.mode_type || null,
							null,
							null,
							initial_is_now,
							initial_selected_unix_time
						)
					);
					stack.pop();
					stack.push(newStackItem);
					return stack;
				});
			}
		} catch (e) {
			console.error('Error checking for OSM station', e);
		}
	};

	$: if (chateau && stop_id) {
		checkOsmStation();
	}
</script>

<GenericStopScreen {buildUrl} key={stop_id} {initial_is_now} {initial_selected_unix_time} />
