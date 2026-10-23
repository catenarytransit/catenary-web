<script lang="ts">
	import { get } from 'svelte/store';
	import { _ } from 'svelte-i18n';
	import { data_stack_store } from '$root/globalstores';
	import { SettingsStack, StackInterface } from '$components/stackenum';
	import {
		autocompleteFocus,
		displayedResults,
		performAutocompleteQuery,
		recalculateBackButton,
		searchText,
		selectResult,
		selectedResultIndex,
		showBackButton
	} from '../state/searchData';

	let textInput = get(searchText);
	let menuOpen = false;
	let directionsOpen = false;
	let origin = '';
	let destination = '';

	function toggleMenu(): void {
		menuOpen = !menuOpen;
		if (menuOpen) directionsOpen = false;
	}

	function openDirections(): void {
		directionsOpen = !directionsOpen;
		menuOpen = false;
		autocompleteFocus.set(false);
		recalculateBackButton();
	}

	function closePanels(): void {
		menuOpen = false;
		directionsOpen = false;
	}


	function handleTextChange(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		textInput = input.value;
		searchText.set(textInput);
		performAutocompleteQuery(textInput);
		autocompleteFocus.set(true);
		recalculateBackButton();
	}

	function focusInput(): void {
		autocompleteFocus.set(true);
		recalculateBackButton();
	}

	function blurInput(event: FocusEvent): void {
		if (window.innerWidth >= 768) {
			const autocomplete = document.getElementById('desktop_autocomplete_box');
			const destination = event.relatedTarget;

			if (!autocomplete || !(destination instanceof Node) || !autocomplete.contains(destination)) {
				autocompleteFocus.set(false);
			}
		}

		recalculateBackButton();
	}

	function handleKeydown(event: KeyboardEvent): void {
		const results = get(displayedResults);
		let index = get(selectedResultIndex);

		if (event.key === 'ArrowDown' || (event.key === 'Tab' && !event.shiftKey)) {
			event.preventDefault();
			if (results.length > 0) {
				index = (index + 1) % results.length;
				selectedResultIndex.set(index);
			}
			return;
		}

		if (event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)) {
			event.preventDefault();
			if (results.length > 0) {
				index = (index - 1 + results.length) % results.length;
				selectedResultIndex.set(index);
			}
			return;
		}

		if (event.key === 'Enter' && index >= 0 && index < results.length) {
			event.preventDefault();
			selectResult(results[index]);
		}
	}

	function closeMobileSearch(): void {
		autocompleteFocus.set(false);
		recalculateBackButton();
	}

	function openSettings(): void {
		closePanels();
		data_stack_store.update((stack) => [...stack, new StackInterface(new SettingsStack())]);
	}

	function clearSearch(): void {
		textInput = '';
		searchText.set('');
		performAutocompleteQuery('');
	}
</script>

<div
	class="w-full rounded-full border border-gray-500 bg-white px-2 py-1 sm:w-2/5 md:w-[350px] xl:w-[456px] dark:bg-gray-900 dark:text-white"
>
	<div class="flex flex-row items-center gap-x-1 align-middle">
		{#if $showBackButton}
			<button
				type="button"
				class="mx-2 inline-block cursor-pointer align-middle text-sm text-black dark:text-white"
				on:click={closeMobileSearch}
				aria-label="Close search"
			>
				<span class="material-symbols-outlined inline-block align-middle">arrow_back</span>
			</button>
		{:else}
			<button
				type="button"
				class="mx-2 inline-flex cursor-pointer items-center justify-center text-gray-600 dark:text-gray-300"
				on:click={toggleMenu}
				aria-label="Open menu"
				aria-expanded={menuOpen}
				aria-controls="search-main-menu"
			>
				<span class="material-symbols-outlined">menu</span>
			</button>
		{/if}

		<input
			type="text"
			on:input={handleTextChange}
			on:focus={focusInput}
			on:blur={blurInput}
			on:keydown={handleKeydown}
			bind:value={textInput}
			class="w-full focus:outline-none"
			placeholder={$_('search_here')}
			aria-label={$_('search_here')}
		/>

		{#if textInput.length === 0}
			<button
				type="button"
				class="mx-2 inline-block cursor-pointer align-middle text-sm text-black dark:text-white"
				on:click={openDirections}
				aria-label="Directions"
				aria-expanded={directionsOpen}
				aria-controls="search-directions-panel"
			>
				<span class="material-symbols-outlined inline-block align-middle">directions</span>
			</button>
		{:else}
			<button
				type="button"
				class="mx-2 inline-block cursor-pointer align-middle text-sm text-black dark:text-white"
				on:click={clearSearch}
				aria-label="Clear search"
			>
				<span class="material-symbols-outlined inline-block align-middle">cancel</span>
			</button>
		{/if}
	</div>
</div>

{#if menuOpen}
	<div id="search-main-menu" class="absolute left-0 top-full z-50 mt-2 min-w-48 rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900" role="menu" aria-label="Main menu">
		<button type="button" role="menuitem" on:click={openSettings} class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800">
			<span class="material-symbols-outlined" aria-hidden="true">settings</span>
			<span>{$_('settings')}</span>
		</button>
	</div>
{/if}

{#if directionsOpen}
	<section id="search-directions-panel" aria-label="Directions" class="absolute left-0 top-full z-50 mt-2 w-full rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-white">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="font-semibold">Directions</h2>
			<button type="button" on:click={() => (directionsOpen = false)} aria-label="Close directions" class="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800"><span class="material-symbols-outlined">close</span></button>
		</div>
		<div class="flex flex-col gap-2">
			<label for="routing-origin" class="text-sm">From</label>
			<input id="routing-origin" type="text" bind:value={origin} placeholder="Choose a starting point" class="rounded-lg border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-600" />
			<label for="routing-destination" class="text-sm">To</label>
			<input id="routing-destination" type="text" bind:value={destination} placeholder="Choose a destination" class="rounded-lg border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-600" />
			<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Route search is not available yet.</p>
		</div>
	</section>
{/if}
