<script lang="ts">
	import { onMount } from 'svelte';
	import { isLoading } from 'svelte-i18n';
	import { MapCanvas, MapControls, createMapController } from '$lib/features/map/public';
	import { SearchOverlay } from '$lib/features/search/public';
	import { LayerSettingsOverlay } from '$lib/features/settings/public';
	import { SidebarShell, createSidebarController } from '$lib/features/sidebar/public';
	import { darkMode } from '$lib/shared/theme/theme';
	import AppHead from './AppHead.svelte';
	import AppOverlays from './AppOverlays.svelte';
	import { initializeApplicationModules, startBrowserRuntime } from './bootstrap';
	import { dismissDonationPopup, showDonationPopup } from './state/overlays';

	initializeApplicationModules();

	const sidebarController = createSidebarController();
	const mapController = createMapController({
		recomputeSidebarPadding: sidebarController.recomputeMapPadding,
		openSidebar: sidebarController.open
	});
	sidebarController.setMapProvider(mapController.getMap);

	onMount(startBrowserRuntime);
</script>

<AppHead />

<svelte:boundary>
	<main class="w-full">
		<MapCanvas controller={mapController} />
		<AppOverlays />
		<SearchOverlay
			sidebar={sidebarController}
			showDonationPopup={$showDonationPopup}
			{dismissDonationPopup}
		/>
		<SidebarShell
			controller={sidebarController}
			darkMode={$darkMode}
			showDonationPopup={$showDonationPopup}
			{dismissDonationPopup}
		/>

		{#if !$isLoading}
			<MapControls controller={mapController} sidebar={sidebarController} />
			<LayerSettingsOverlay controller={mapController} />
		{/if}
	</main>
</svelte:boundary>
