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

<div bind:this={container} class="fixed top-0 left-0 h-[100vh] w-[100vw]"></div>
