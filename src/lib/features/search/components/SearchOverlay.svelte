<script lang="ts">
	import { data_stack_store } from '$root/globalstores';
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
</script>

<div
	class="fixed top-2 right-3 left-3 z-40 sm:right-auto"
	id="search_bar_outer"
	style={`transform: translateY(${$sidebarState.searchTranslateY}px);`}
>
	<SearchBar />
</div>

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

{#if $autocompleteFocus}
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
