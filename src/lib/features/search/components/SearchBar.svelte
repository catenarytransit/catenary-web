<script lang="ts">
	import { get } from 'svelte/store';
	import { _, isLoading } from 'svelte-i18n';
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
		data_stack_store.update((stack) => [...stack, new StackInterface(new SettingsStack())]);
	}

	function clearSearch(): void {
		textInput = '';
		searchText.set('');
		selectedResultIndex.set(-1);
	}
</script>

{#if !$isLoading}
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
				<img src="/logo.svg" alt="Catenary" class="my-auto mr-1 inline h-4 align-middle" />
			{/if}

			<input
				type="search"
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
					on:click={openSettings}
					aria-label="Settings"
				>
					<span class="material-symbols-outlined inline-block align-middle">settings</span>
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
{/if}
