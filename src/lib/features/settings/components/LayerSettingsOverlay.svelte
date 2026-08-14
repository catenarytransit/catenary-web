<script lang="ts">
	import { onDestroy } from 'svelte';
	import { isLoading, locale } from 'svelte-i18n';
	import { usunits_store } from '$root/globalstores';
	import { darkMode } from '$lib/shared/theme/theme';
	import type { MapController } from '$lib/features/map/public';

	export let controller: MapController;

	let open = false;
	let settings = controller.layerSettings;
	const unsubscribe = controller.layerSettingsOpen.subscribe((value) => {
		open = value;
	});

	$: controller.layerSettingsOpen.set(open);
	$: controller.setLayerSettings(settings);

	onDestroy(unsubscribe);
</script>

{#if !$isLoading}
	{#await import('$components/LayerSettingsBox.svelte') then { default: LayerSettingsBox }}
		<LayerSettingsBox
			bind:layersettingsBox={open}
			bind:layersettings={settings}
			runSettingsAdapt={controller.applyLayerSettings}
			darkMode={$darkMode}
			usunits={$usunits_store}
			current_locale={$locale ?? 'default'}
		/>
	{:catch error}
		<p class="fixed right-4 bottom-4 z-50 rounded bg-red-100 p-3 text-sm text-red-800">
			Unable to load layer settings: {error.message}
		</p>
	{/await}
{/if}
