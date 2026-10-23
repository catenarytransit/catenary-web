<script lang="ts">
	import { get } from 'svelte/store';
	import { _ } from 'svelte-i18n';
	import { data_stack_store } from '$root/globalstores';
	import { DirectionsStack, SettingsStack, StackInterface } from '$components/stackenum';
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

	function toggleMenu(): void {
		menuOpen = !menuOpen;
	}

	function openDirections(): void {
		menuOpen = false;
		autocompleteFocus.set(false);
		recalculateBackButton();
		data_stack_store.update((stack) => [...stack, new StackInterface(new DirectionsStack())]);
	}

	function closePanels(): void {
		menuOpen = false;
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
				aria-label="Directions / Trip Planner"
				title="Directions / Trip Planner"
			>
				<span class="material-symbols-outlined inline-block align-middle" style="color: rgb(0, 123, 139); font-variation-settings: 'FILL' 1;">directions</span>
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

