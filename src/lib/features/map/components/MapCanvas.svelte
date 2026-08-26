<script lang="ts">
	import { onMount } from 'svelte';
	import type { MapController } from '../controller/createMapController';

	export let controller: MapController;

	let container: HTMLDivElement;

	onMount(() => {
		controller.start(container);
		return () => controller.destroy();
	});
</script>

<div bind:this={container} class="fixed inset-0 z-0 h-[100dvh] w-screen"></div>
