<script lang="ts">
	import { onMount } from 'svelte';
	import { isLoading } from 'svelte-i18n';
	import { data_stack_store, usunits_store } from '$root/globalstores';
	import SidebarContent from './SidebarContent.svelte';
	import type { SidebarController } from '../controller/createSidebarController';

	export let controller: SidebarController;
	export let darkMode: boolean;
	export let showDonationPopup = false;
	export let dismissDonationPopup: () => void;

	const state = controller.state;
	$: latestItem = $data_stack_store[$data_stack_store.length - 1] ?? null;

	onMount(() => controller.start());
</script>

<button
	type="button"
	class="fixed z-30 hidden items-center rounded-r-md bg-white p-1 text-black md:flex dark:bg-gray-900 dark:text-white"
	aria-label={$state.position === 'full' ? 'Close sidebar' : 'Open sidebar'}
	on:click={controller.toggle}
	style={`left: ${$state.collapserLeft}; top: ${$state.collapserTop};`}
>
	<span class="material-symbols-outlined my-auto block">
		{$state.position === 'none' ? 'chevron_right' : 'chevron_left'}
	</span>
</button>

{#if !$isLoading}
	<aside
		id="catenary-sidebar"
		style={`height: ${$state.height}; transform: translateX(${$state.translateX});`}
		class="fixed bottom-0 left-0 z-20 flex w-full flex-col rounded-t-2xl bg-white text-black sm:w-2/5 md:top-0 md:bottom-0 md:h-full md:w-[380px] md:rounded-none xl:w-[480px] dark:bg-gray-900 dark:text-white"
		aria-label="Trip and map information"
	>
		<div
			class="flex flex-row py-2 md:hidden"
			on:mousedown={controller.startDrag}
			on:touchstart={controller.startDrag}
			aria-label="Resize sidebar"
			role="presentation"
		>
			<div class="mx-auto rounded-lg bg-sky-500 px-8 py-1 dark:bg-sky-400"></div>
		</div>

		<SidebarContent
			usunits={$usunits_store}
			latest_item_on_stack={latestItem}
			{darkMode}
			{showDonationPopup}
			{dismissDonationPopup}
		/>
	</aside>
{/if}
