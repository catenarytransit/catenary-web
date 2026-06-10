<script lang="ts">
	import { _ } from 'svelte-i18n';
	import CloseButton from './CloseButton.svelte';
	import Layerselectionbox from './layerselectionbox.svelte';
	import Layerbutton from './layerbutton.svelte';
	import Realtimelabel from '../realtimelabel.svelte';
	import {
		current_orm_layer_type_store,
		show_zombie_buses_store,
		show_my_location_store,
		show_topo_global_store,
		map_pointer_store
	} from '../globalstores';
	import { get } from 'svelte/store';
	import { onDestroy } from 'svelte';

	export let layersettingsBox: boolean;
	export let layersettings: Record<string, any>;
	export let runSettingsAdapt: () => void;
	export let darkMode: boolean;
	export let usunits: boolean;
	export let current_locale: string;

	let selectedSettingsTab = 'localrail';
	let showEditMenu: 'routes' | 'stops' | null = null;

	const enabledlayerstyle =
		'text-black dark:text-white bg-blue-200 dark:bg-gray-700 border border-blue-800 dark:border-blue-200 text-sm md:text-sm';
	const disabledlayerstyle =
		'text-gray-900 dark:text-gray-50 border bg-gray-300 border-gray-400 dark:bg-gray-800  dark:border-gray-700 text-sm md:text-sm';

	let current_orm_layer_type: string | null = get(current_orm_layer_type_store);
	current_orm_layer_type_store.subscribe((value) => {
		current_orm_layer_type = value;
	});

	let showzombiebuses = get(show_zombie_buses_store);
	show_zombie_buses_store.subscribe((value) => {
		showzombiebuses = value;
	});

	let show_my_location = get(show_my_location_store);
	show_my_location_store.subscribe((value) => {
		show_my_location = value;
	});

	let show_topo = get(show_topo_global_store);
	show_topo_global_store.subscribe((value) => {
		show_topo = value;
	});

	let currentZoom: number | null = null;
	let mapInstance: maplibregl.Map | null = null;

	function handleZoom() {
		if (mapInstance) {
			currentZoom = Math.round(mapInstance.getZoom() * 10) / 10;
		}
	}

	const unsubscribeMap = map_pointer_store.subscribe((map) => {
		if (mapInstance) {
			mapInstance.off('zoom', handleZoom);
		}
		mapInstance = map;
		if (mapInstance) {
			currentZoom = Math.round(mapInstance.getZoom() * 10) / 10;
			mapInstance.on('zoom', handleZoom);
		} else {
			currentZoom = null;
		}
	});

	onDestroy(() => {
		unsubscribeMap();
		if (mapInstance) {
			mapInstance.off('zoom', handleZoom);
		}
	});
</script>

<div
	class="z-50 dark:shadow-gray-800 shadow-lg fixed bottom-0 w-full rounded-t-lg sm:w-fit sm:bottom-4 sm:right-4 bg-white dark:bg-gray-900 dark:text-gray-50 bg-opacity-90 dark:bg-opacity-90 sm:rounded-lg z-50 px-3 py-2 {layersettingsBox
		? ''
		: 'hidden'}"
>
	<div class="flex flex-row align-middle items-center">
		{#if showEditMenu}
			<button
				on:click={() => {
					showEditMenu = null;
				}}
				class="mr-2 text-gray-500 hover:text-gray-850 dark:hover:text-gray-250 flex items-center justify-center p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
				aria-label="Back"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
				</svg>
			</button>
			<h2 class="font-bold text-gray-800 dark:text-gray-200">
				{$_('edit_layer_settings', { default: showEditMenu === 'routes' ? 'Edit Route Settings' : 'Edit Stop Settings' })}
			</h2>
		{:else}
			<h2 class="font-bold text-gray-800 dark:text-gray-200">{$_('layers')}</h2>
		{/if}
		<div class="ml-auto">
			<CloseButton
				onclose={() => {
					layersettingsBox = false;
					showEditMenu = null;
				}}
				moreclasses=""
				parentclass=""
			/>
		</div>
	</div>
	{#if showEditMenu === 'routes'}
		<div class="flex flex-col gap-y-3.5 my-3 w-full sm:min-w-[280px]">
			<!-- Checkbox 1: Show Route Labels -->
			<label class="flex items-center justify-between cursor-pointer py-0.5 select-none">
				<span class="text-sm font-medium text-gray-750 dark:text-gray-300">Show Route Labels</span>
				<input
					type="checkbox"
					checked={layersettings[selectedSettingsTab]?.showRoutesLabels !== false}
					on:change={(e) => {
						const val = e.currentTarget.checked;
						layersettings[selectedSettingsTab].showRoutesLabels = val;
						if (layersettings[selectedSettingsTab].shapes) {
							layersettings[selectedSettingsTab].labelshapes = val;
						}
						runSettingsAdapt();
					}}
					class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
				/>
			</label>

			<!-- Slider: Min Zoom for Route Shapes -->
			<div class="flex flex-col gap-y-1.5 py-0.5">
				<div class="flex justify-between items-center select-none">
					<span class="text-sm font-medium text-gray-750 dark:text-gray-300">Route Shapes Min Zoom</span>
					<div class="flex items-center gap-x-1.5">
						<span class="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
							{layersettings[selectedSettingsTab]?.routesMinZoom ?? (selectedSettingsTab === 'bus' ? 10 : (selectedSettingsTab === 'localrail' ? 5 : 3))}
						</span>
						<button
							on:click={() => {
								const defaultVal = selectedSettingsTab === 'bus' ? 10 : (selectedSettingsTab === 'localrail' ? 5 : 3);
								layersettings[selectedSettingsTab].routesMinZoom = defaultVal;
								runSettingsAdapt();
							}}
							class="p-0.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"
							title="Reset to default"
							aria-label="Reset to default"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
							</svg>
						</button>
					</div>
				</div>
				<div class="relative w-full py-1">
					<input
						type="range"
						min={selectedSettingsTab === 'bus' ? 6 : 3}
						max="16"
						step="1"
						value={layersettings[selectedSettingsTab]?.routesMinZoom ?? (selectedSettingsTab === 'bus' ? 10 : (selectedSettingsTab === 'localrail' ? 5 : 3))}
						on:input={(e) => {
							layersettings[selectedSettingsTab].routesMinZoom = parseInt(e.currentTarget.value);
							runSettingsAdapt();
						}}
						class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600 relative z-10"
					/>
					<div
						class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-0.5 h-3.5 bg-gray-400 dark:bg-gray-500 z-0 pointer-events-none rounded-full"
						style="left: {(((selectedSettingsTab === 'bus' ? 10 : (selectedSettingsTab === 'localrail' ? 5 : 3)) - (selectedSettingsTab === 'bus' ? 6 : 3)) / (16 - (selectedSettingsTab === 'bus' ? 6 : 3))) * 100}%;"
						title="Default: {selectedSettingsTab === 'bus' ? 10 : (selectedSettingsTab === 'localrail' ? 5 : 3)}"
					></div>
				</div>
				<div class="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 px-0.5 select-none">
					<span>Zoom {selectedSettingsTab === 'bus' ? 6 : 3} ({selectedSettingsTab === 'bus' ? 'Min' : 'Far'})</span>
					<span>Zoom 16 (Near)</span>
				</div>
			</div>
			{#if currentZoom !== null}
				<div class="text-[11px] text-gray-500 dark:text-gray-400 select-none pt-1.5 border-t border-gray-150 dark:border-gray-800 mt-0.5">
					Current Map Zoom: <span class="font-semibold text-gray-700 dark:text-gray-300">{currentZoom}</span>
				</div>
			{/if}
		</div>{:else if showEditMenu === 'stops'}
		<div class="flex flex-col gap-y-3.5 my-3 w-full sm:min-w-[280px]">
			<!-- Checkbox 2: Show Stop Names -->
			<label class="flex items-center justify-between cursor-pointer py-0.5 select-none">
				<span class="text-sm font-medium text-gray-750 dark:text-gray-300">Show Stop Names</span>
				<input
					type="checkbox"
					checked={layersettings[selectedSettingsTab]?.showStopNames !== false}
					on:change={(e) => {
						const val = e.currentTarget.checked;
						layersettings[selectedSettingsTab].showStopNames = val;
						if (layersettings[selectedSettingsTab].stops) {
							layersettings[selectedSettingsTab].stoplabels = val;
						}
						runSettingsAdapt();
					}}
					class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
				/>
			</label>
			{#if currentZoom !== null}
				<div class="text-[11px] text-gray-500 dark:text-gray-400 select-none pt-1.5 border-t border-gray-150 dark:border-gray-800 mt-0.5">
					Current Map Zoom: <span class="font-semibold text-gray-700 dark:text-gray-300">{currentZoom}</span>
				</div>
			{/if}
		</div>
	{:else}
		<div class="rounded-xl mx-0 my-2 flex flex-row w-full text-black dark:text-white">
			<Layerselectionbox
				text={$_('headingIntercityRail')}
				changesetting={() => {
					selectedSettingsTab = 'intercityrail';
				}}
				cssclass={`${
					selectedSettingsTab === 'intercityrail' ? enabledlayerstyle : disabledlayerstyle
				} w-1/2 py-1 px-1`}
			/>

			<Layerselectionbox
				text={$_('headingLocalRail')}
				changesetting={() => {
					selectedSettingsTab = 'localrail';
				}}
				cssclass={`${
					selectedSettingsTab === 'localrail' ? enabledlayerstyle : disabledlayerstyle
				} w-1/2 py-1 px-1`}
			/>

			<Layerselectionbox
				text={$_('headingBus')}
				changesetting={() => {
					selectedSettingsTab = 'bus';
				}}
				cssclass={`${selectedSettingsTab === 'bus' ? enabledlayerstyle : disabledlayerstyle} w-1/2 py-1 px-1`}
			/>

			<Layerselectionbox
				text={$_('headingOther')}
				changesetting={() => {
					selectedSettingsTab = 'other';
				}}
				cssclass={`${
					selectedSettingsTab === 'other' ? enabledlayerstyle : disabledlayerstyle
				} w-1/2 py-1 px-1`}
			/>

			<div
				on:click={() => {
					selectedSettingsTab = 'more';
				}}
				on:keydown={() => {
					selectedSettingsTab = 'more';
				}}
				class={`${
					selectedSettingsTab === 'more' ? enabledlayerstyle : disabledlayerstyle
				} w-1/2 py-1 px-1`}
				role="button"
				tabindex="0"
			>
				<p class="w-full align-center text-center">{$_('headingMisc')}</p>
			</div>
		</div>

		{#if selectedSettingsTab === 'more'}
			<div class="flex flex-col">
				<!--radio group that changes  current_orm_layer_type-->

				<!--First option, null-->

				<p class="font-bold">ORM</p>

				<div>
					<input
						on:click={() => {
							current_orm_layer_type_store.set(null);
						}}
						on:keydown={() => {
							current_orm_layer_type_store.set(null);
						}}
						type="radio"
						class="h-4 w-4 border-gray-300 focus:ring-2 focus:ring-blue-300 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-blue-600"
						name="orm-layer-type"
						value="null"
						id="no-orm-data"
						checked={current_orm_layer_type == null}
					/>
					<label for="no-orm-data" class="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300"
						>{$_('noormdata')}</label
					>
				</div>

				<div>
					<input
						on:click={() => {
							current_orm_layer_type_store.set('infrastructure');
						}}
						on:keydown={() => {
							current_orm_layer_type_store.set('infrastructure');
						}}
						type="radio"
						class="h-4 w-4 border-gray-300 focus:ring-2 focus:ring-blue-300 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-blue-600"
						name="orm-layer-type"
						value="infrastructure"
						id="orm-infra"
						checked={current_orm_layer_type == 'infrastructure'}
					/>
					<label for="orm-infra" class="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300"
						>{$_('orminfra')}</label
					>
				</div>
			</div>

			<div>
				<input
					on:click={() => {
						show_zombie_buses_store.update((value) => !value);
						localStorage.setItem('showzombiebuses', String(!showzombiebuses));
						runSettingsAdapt();
					}}
					on:keydown={() => {
						show_zombie_buses_store.update((value) => !value);
						localStorage.setItem('showzombiebuses', String(!showzombiebuses));
						runSettingsAdapt();
					}}
					checked={showzombiebuses}
					id="show-zombie-buses"
					type="checkbox"
					class="align-middle my-auto w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
				/>
				<label for="show-zombie-buses" class="ml-2">{$_('showtripless')}</label>
			</div>
			<div>
				<input
					on:click={() => {
						show_my_location_store.update((value) => !value);
						localStorage.setItem('show-my-location', String(!show_my_location));
						runSettingsAdapt();
					}}
					on:keydown={() => {
						show_my_location_store.update((value) => !value);
						localStorage.setItem('show-my-location', String(!show_my_location));
						runSettingsAdapt();
					}}
					checked={show_my_location}
					id="show-my-location"
					type="checkbox"
					class="align-middle my-auto w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
				/>
				<label for="show-my-location" class="ml-2">{$_('showmylocation')}</label>
			</div>

			<div>
				<input
					on:click={() => {
						show_topo_global_store.update((value) => !value);
						localStorage.setItem('show-topo', String(!show_topo));
						runSettingsAdapt();
					}}
					on:keydown={() => {
						show_topo_global_store.update((value) => !value);
						localStorage.setItem('show-topo', String(!show_topo));
						runSettingsAdapt();
					}}
					checked={show_topo}
					id="show-topo-toggle"
					type="checkbox"
					class="align-middle my-auto w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
				/>
				<label for="show-topo-toggle" class="ml-2">{$_('topo')}</label>
			</div>
		{/if}

		{#if ['other', 'bus', 'intercityrail', 'localrail'].includes(selectedSettingsTab)}
			<div class="grid grid-cols-3 gap-x-3 items-start justify-items-center">
				<div class="flex flex-col items-center gap-y-1.5 w-full">
					<Layerbutton
						bind:layersettings
						bind:selectedSettingsTab
						change="shapes"
						name={$_('routes')}
						urlicon="/routesicon.svg"
						{runSettingsAdapt}
					/>
					<button
						on:click={() => {
							showEditMenu = 'routes';
						}}
						class="px-3 py-0.5 text-[10px] font-semibold rounded-full border border-gray-300 dark:border-gray-700 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors shadow-sm select-none"
					>
						Edit
					</button>
				</div>

				<div class="flex flex-col items-center gap-y-1.5 w-full">
					<Layerbutton
						bind:layersettings
						bind:selectedSettingsTab
						change="stops"
						name={$_('stops')}
						urlicon="/stopsicon.svg"
						{runSettingsAdapt}
					/>
					<button
						on:click={() => {
							showEditMenu = 'stops';
						}}
						class="px-3 py-0.5 text-[10px] font-semibold rounded-full border border-gray-300 dark:border-gray-700 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors shadow-sm select-none"
					>
						Edit
					</button>
				</div>

				<div class="flex flex-col items-center gap-y-1.5 w-full">
					<Layerbutton
						bind:layersettings
						bind:selectedSettingsTab
						change="visible"
						name={$_('vehicles')}
						urlicon="/vehiclesicon.svg"
						{runSettingsAdapt}
					/>
				</div>
			</div>

			<p>Vehicle Labels</p>

			<div class="flex flex-row gap-x-3 justify-evenly">
				<Realtimelabel
					bind:layersettings
					bind:selectedSettingsTab
					change="route"
					name={$_('showroute')}
					symbol="route"
					{runSettingsAdapt}
				/>
				<Realtimelabel
					bind:layersettings
					bind:selectedSettingsTab
					change="trip"
					name={$_('showtrip')}
					symbol="mode_of_travel"
					{runSettingsAdapt}
				/>
				<Realtimelabel
					bind:layersettings
					bind:selectedSettingsTab
					change="vehicle"
					name={$_('showvehicle')}
					symbol="train"
					{runSettingsAdapt}
				/>

				<Realtimelabel
					bind:layersettings
					bind:selectedSettingsTab
					change="headsign"
					name={$_('headsign')}
					symbol="sports_score"
					{runSettingsAdapt}
				/>

				<Realtimelabel
					bind:layersettings
					bind:selectedSettingsTab
					change="speed"
					name={$_('showspeed')}
					symbol="speed"
					{runSettingsAdapt}
				/>

				<Realtimelabel
					bind:layersettings
					bind:selectedSettingsTab
					change="occupancy"
					name={$_('occupancy')}
					symbol="group"
					{runSettingsAdapt}
				/>

				<Realtimelabel
					bind:layersettings
					bind:selectedSettingsTab
					change="delay"
					name={$_('delay')}
					symbol="timer"
					{runSettingsAdapt}
				/>
			</div>
		{/if}
	{/if}
</div>
