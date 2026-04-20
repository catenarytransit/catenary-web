<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import DelayDiff from './DelayDiff.svelte';

	export let possible_trip_list: any[] = [];

	export let stops: Record<string, any> = {};

	let likely_trip: any = null;

	export let vehicle: any;

	$: if (possible_trip_list) {
		console.log(possible_trip_list);

		if (possible_trip_list.length == 1) {
			likely_trip = possible_trip_list[0];
		}

		if (possible_trip_list.length > 1) {
			// likely_trip = possible_trip_list[0]
			console.log('more than one likely trip', possible_trip_list);

			let new_list = possible_trip_list.filter((each_possible_trip) => {
				if (vehicle.trip.start_date) {
					if (each_possible_trip.trip.start_date.replaceAll('-', '') != vehicle.trip.start_date) {
						return false;
					}
				}

				if (vehicle.trip.start_time) {
					if (each_possible_trip.trip.start_time != vehicle.trip.start_time) {
						return false;
					}
				}

				return true;
			});

			console.log('new list', new_list);

			if (new_list.length > 0) {
				likely_trip = new_list[0];
			}
		}
	}

	onMount(() => {
		console.log(vehicle);
	});
</script>

<p>
	{#if likely_trip}
		{#if likely_trip.stop_time_update[0]}
			{#if stops[likely_trip.stop_time_update[0].stop_id]}
				<p class="text-xs">
					{$_('next_stop')}: {stops[likely_trip.stop_time_update[0].stop_id].name}
				</p>
			{/if}
			{#if vehicle.trip.delay != null}
				<p class="text-xs">
					<DelayDiff use_symbol_sign={true} diff={vehicle.trip.delay} />
				</p>
			{/if}
		{/if}
	{/if}
</p>
