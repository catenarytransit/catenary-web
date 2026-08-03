<script lang="ts">
	import { locale } from 'svelte-i18n';
	import {
		geolocation_store,
		lock_on_gps_store,
		usunits_store
	} from '$root/globalstores';
	import { darkMode } from '$lib/shared/theme/theme';
	import type { SidebarController } from '$lib/features/sidebar/public';
	import type { MapController } from '../controller/createMapController';

	export let controller: MapController;
	export let sidebar: SidebarController;

	const heading = controller.heading;
	const desktopApp = controller.desktopApp;
	const sidebarState = sidebar.state;

	function formatSpeed(speedMetresPerSecond: number, useUsUnits: boolean) {
		const converted = speedMetresPerSecond * (useUsUnits ? 2.23694 : 3.6);
		const [whole, decimal] = converted.toFixed(1).split('.');
		return { whole, decimal, unit: useUsUnits ? 'mph' : 'km/h' };
	}

	$: speed =
		typeof $geolocation_store?.coords.speed === 'number'
			? formatSpeed($geolocation_store.coords.speed, $usunits_store)
			: null;
	$: decimalSeparator = ['fr', 'de', 'it', 'es', 'se'].includes(
		($locale ?? 'default').split('-')[0]
	)
		? ','
		: '.';
	$: gpsBottomOffset = ($sidebarState.height, sidebar.getGpsButtonBottomOffset());
</script>

<div class="pointer-events-none fixed top-12 right-4 flex flex-col gap-y-2 sm:top-4">
	<button
		type="button"
		aria-label="Layers"
		on:click={() => controller.layerSettingsOpen.update((open) => !open)}
		class="pointer-events-auto z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white dark:bg-gray-900 dark:text-gray-50"
	>
		<span class="material-symbols-outlined select-none">layers</span>
	</button>

	<button
		type="button"
		on:click={controller.resetNorth}
		aria-label="Reset map to north"
		class="pointer-events-auto z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-gray-900 dark:text-gray-50"
	>
		<img
			src={$heading < 7 && $heading > -7
				? $darkMode
					? '/icons/north.svg'
					: '/icons/light_north.svg'
				: '/icons/compass.svg'}
			alt=""
			class="h-7"
			style={`transform: rotate(${-1 * $heading}deg)`}
		/>
	</button>

	{#if !$desktopApp && speed}
		<div
			class="rounded-lg border border-gray-500 bg-white px-1 py-0.5 text-black shadow-sm shadow-gray-400 dark:bg-gray-800 dark:text-white dark:shadow-gray-700"
		>
			<p class="text-center leading-none">
				<span class="text-sm font-semibold">{speed.whole}</span><span class="text-sm"
					>{decimalSeparator}{speed.decimal}</span
				><br />
				<span class="text-xs">{speed.unit}</span>
			</p>
		</div>
	{/if}
</div>

{#if !$desktopApp}
	<button
		type="button"
		on:click={controller.focusUserLocation}
		style={`bottom: ${gpsBottomOffset}`}
		aria-label={$lock_on_gps_store ? 'Map following my location' : 'Go to my location'}
		class="clickable pointer-events-auto fixed right-4 z-50 flex h-16 w-16 select-none items-center justify-center rounded-full bg-white dark:bg-gray-900 {$lock_on_gps_store
			? 'text-blue-500 dark:text-blue-300'
			: 'text-gray-900 dark:text-gray-50'}"
	>
		<span class="material-symbols-outlined select-none text-lg">
			{$lock_on_gps_store ? 'my_location' : 'location_searching'}
		</span>
	</button>
{/if}
