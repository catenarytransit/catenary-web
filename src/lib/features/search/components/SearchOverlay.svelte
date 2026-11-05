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
	class="fixed top-2 right-3 left-3 z-40 sm:right-auto"
	id="search_bar_outer"
	style={`transform: translateY(${$sidebarState.searchTranslateY}px);`}
>
	<SearchBar />
</div>
{/if}

{#if !showingDirections && $autocompleteFocus}
	<div
		id="desktop_autocomplete_box"
		class="fixed top-12 left-3 z-40 hidden w-[350px] rounded-sm border border-gray-500 bg-gray-100 md:block xl:w-[456px] dark:bg-gray-900"
	>
		<SearchAutocompleteList length={10} />
	</div>

	<div
		class="fixed top-0 right-0 bottom-0 left-0 z-30 h-full bg-gray-100 px-3 sm:right-1/2 md:hidden dark:bg-gray-900"
	>
		<div class="relative top-12 w-full">
			<SearchAutocompleteList length={10} />
			<p class="text-xs dark:text-gray-200">Catenary Search Beta.</p>
		</div>
	</div>
{/if}
