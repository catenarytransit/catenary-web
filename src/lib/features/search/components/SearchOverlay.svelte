<script lang="ts">
	import { data_stack_store } from '$root/globalstores';
	import { TripPlannerStack } from '$components/stackenum';
	import type { SidebarController } from '$lib/features/sidebar/public';
	import SearchAutocompleteList from './SearchAutocompleteList.svelte';
	import SearchBar from './SearchBar.svelte';
	import { autocompleteFocus } from '../state/searchData';

	export let sidebar: SidebarController;

	const sidebarState = sidebar.state;
	$: showingDirections = $data_stack_store[$data_stack_store.length - 1]?.data instanceof TripPlannerStack;
</script>

{#if !showingDirections}
	<div
		class="fixed top-2 right-3 left-3 z-40 border border-gray-200 bg-white shadow-lg sm:right-auto sm:w-2/5 md:w-[350px] xl:w-[456px] dark:border-gray-700 dark:bg-gray-900 dark:text-white {$autocompleteFocus ? 'rounded-xl' : 'rounded-full'}"
		id="search_bar_outer"
		style={`transform: translateY(${$sidebarState.searchTranslateY}px);`}
	>
		<SearchBar />
		{#if $autocompleteFocus}
			<div
				id="desktop_autocomplete_box"
				class="max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-b-xl border-t border-gray-200 dark:border-gray-700"
			>
				<SearchAutocompleteList length={10} />
				<p class="px-3 py-2 text-xs text-gray-600 md:hidden dark:text-gray-300">Catenary Search Beta.</p>
			</div>
		{/if}
	</div>
{/if}
