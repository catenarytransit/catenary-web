<script lang="ts">
	import { data_stack_store } from '$root/globalstores';
	import { TripPlannerStack } from '$components/stackenum';
	import DonationPopup from '$components/DonationPopup.svelte';
	import type { SidebarController } from '$lib/features/sidebar/public';
	import SearchAutocompleteList from './SearchAutocompleteList.svelte';
	import SearchBar from './SearchBar.svelte';
	import { autocompleteFocus } from '../state/searchData';

	export let sidebar: SidebarController;
	export let showDonationPopup = false;
	export let dismissDonationPopup: () => void;

	const sidebarState = sidebar.state;
	$: hasSidebarScreen = $data_stack_store.length > 0;
	$: showingDirections = $data_stack_store[$data_stack_store.length - 1]?.data instanceof TripPlannerStack;
</script>

{#if !showingDirections}
	<div
		class="fixed top-2 right-3 left-3 z-40 bg-white shadow-lg sm:right-auto sm:w-2/5 md:w-[350px] xl:w-[456px] dark:bg-gray-900 dark:text-white {$autocompleteFocus ? 'rounded-xl' : 'rounded-full'}"
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

{#if showDonationPopup && !hasSidebarScreen && !$autocompleteFocus}
	<div
		class="fixed top-12 right-16 left-3 z-30 sm:right-auto sm:w-2/5 md:hidden"
		style={`transform: translateY(${$sidebarState.searchTranslateY}px);`}
	>
		<DonationPopup
			title="Help keep Catenary Maps running"
			message="Our aging server is reaching its limits. Your support helps us replace it and add the computing power needed to release trip planning and navigation."
			compact
			on:dismiss={dismissDonationPopup}
		/>
	</div>
{/if}
