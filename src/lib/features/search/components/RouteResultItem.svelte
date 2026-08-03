<script lang="ts">
	import RouteBadge from './RouteBadge.svelte';

	export let routeInfo: any; // TODO: Define a proper interface for RouteInfo
	export let onClick: () => void;
	export let chateau: string;
	export let route_id: string;
</script>

<button
	class="px-3 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer w-full flex flex-col content-start items-start align-left"
	on:click={onClick}
>
	<div class="flex items-center py-2">
		{#if routeInfo.short_name || routeInfo.long_name}
			<RouteBadge route={routeInfo} {chateau} {route_id} />
		{/if}
		{#if routeInfo.long_name}
			<p class="text-sm text-gray-800 dark:text-gray-200 ml-2">
				{routeInfo.long_name}
			</p>
		{/if}
	</div>
</button>
