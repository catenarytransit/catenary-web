<script lang="ts">
	import {
		data_stack_store,
		on_sidebar_trigger_store,
		realtime_vehicle_locations_last_updated_store,
		realtime_vehicle_locations_store,
		realtime_vehicle_route_cache_hash_store,
		realtime_vehicle_route_cache_store,
		lock_on_gps_store,
		usunits_store,
		show_zombie_buses_store,
		show_my_location_store,
		custom_icons_category_to_layer_id,
		map_pointer_store,
		geolocation_store,
		chateaus_store,
		show_gtfs_ids_store,
		ui_theme_store,
		show_topo_global_store,
		current_orm_layer_type_store
	} from '../../globalstores';

	import {
		MapSelectionScreen,
		StackInterface,
		MapSelectionOption,
		SingleTrip,
		VehicleMapSelector,
		RouteStack,
		StopStack,
		RouteMapSelector,
		SettingsStack
	} from '../stackenum';

	import { init_locales } from '../../i18n';
	import { _ } from 'svelte-i18n';
	import { isLoading } from 'svelte-i18n';
	import { text_input_store } from './search_data';
	import { get } from 'svelte/store';

	import {
		new_query,
		autocomplete_focus_state,
		show_back_button_recalc,
		show_back_button_store,
		selected_result_index_store,
		displayed_results_store,
		select_result_item
	} from './search_data';

	let show_back_button = false;

	show_back_button_store.subscribe((new_state) => {
		show_back_button = new_state;
	});

	let text_input = get(text_input_store);

	function handle_text_change(event) {
		text_input = event.target.value;
		text_input_store.set(text_input);

		new_query(text_input);

		autocomplete_focus_state.set(true);

		show_back_button_recalc();
	}

	function focus_on_input(event) {
		autocomplete_focus_state.set(true);

		show_back_button_recalc();
	}

	function on_blur_input(event) {
		console.log('search bar blurred', event);

		if (window.innerWidth >= 768) {
			const destinationElement = event.relatedTarget;

			console.log('destination element', destinationElement);

			const desktop_autocomplete_box = document.getElementById('desktop_autocomplete_box');

			if (desktop_autocomplete_box) {
				if (!desktop_autocomplete_box.contains(destinationElement)) {
					console.log('clicked outside automcomplete');
					autocomplete_focus_state.set(false);
				}
			}
		}

		show_back_button_recalc();
	}

	function handle_keydown(event: KeyboardEvent) {
		const total_results = get(displayed_results_store).length;
		let current_index = get(selected_result_index_store);

		if (event.key === 'ArrowDown' || (event.key === 'Tab' && !event.shiftKey)) {
			event.preventDefault();
			if (total_results > 0) {
				current_index = (current_index + 1) % total_results;
				selected_result_index_store.set(current_index);
			}
		} else if (event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)) {
			event.preventDefault();
			if (total_results > 0) {
				current_index = (current_index - 1 + total_results) % total_results;
				selected_result_index_store.set(current_index);
			}
		} else if (event.key === 'Enter') {
			if (current_index >= 0 && current_index < total_results) {
				event.preventDefault();
				select_result_item(get(displayed_results_store)[current_index]);
			}
		}
	}
</script>

{#if !$isLoading}
	<div
		class="rounded-full py-1 px-2 bg-white-500 border border-gray-500 bg-white dark:bg-gray-900 dark:text-white w-full sm:w-2/5 md:w-[350px]"
	>
		<div class="flex flex-row gap-x-1 align-middle items-center">
			{#if show_back_button == true}
				<button
					class="text-black dark:text-white text-sm cursor-pointer mx-2 inline-block align-middle"
					on:click={() => {
						autocomplete_focus_state.set(false);
						show_back_button = false;
						show_back_button_recalc();
					}}
					aria-label="Settings"
					><span class="material-symbols-outlined inline-block align-middle"> arrow_back </span>
				</button>
			{:else}
				<img src="/logo.svg" alt="Catenary" class="h-4 mr-1 inline align-middle my-auto" />
			{/if}
			<input
				type="text"
				on:input={handle_text_change}
				on:focus={focus_on_input}
				on:blur={on_blur_input}
				on:keydown={handle_keydown}
				bind:value={text_input}
				class="w-full focus:outline-none"
				placeholder={$_('search_here')}
			/>

			{#if text_input.length == 0}
				<button
					class="text-black dark:text-white text-sm cursor-pointer mx-2 inline-block align-middle"
					on:click={() => {
						data_stack_store.update((x) => {
							x.push(new StackInterface(new SettingsStack()));
							return x;
						});
					}}
					aria-label="Settings"
					><span class="material-symbols-outlined inline-block align-middle"> settings </span>
				</button>
			{:else}
				<button
					class="text-black dark:text-white text-sm cursor-pointer mx-2 inline-block align-middle"
					on:click={() => {
						text_input = '';
						text_input_store.set('');
					}}
					aria-label="Settings"
					><span class="material-symbols-outlined inline-block align-middle"> cancel </span>
				</button>
			{/if}
		</div>
	</div>
{/if}
