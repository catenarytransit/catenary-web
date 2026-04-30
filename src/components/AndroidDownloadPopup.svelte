<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { onMount } from 'svelte';

	const androidPopupDismissUntilStorage = 'androidPopupDismissedUntil';
	const oneWeekInMs = 7* 24 * 60 * 60 * 1000;

	let showAndroidDownloadPopup = false;
	let isAndroid = false;
	let isChrome = false;

	onMount(() => {
		isAndroid = /Android/i.test(navigator.userAgent);
		isChrome = /Chrome/i.test(navigator.userAgent);

		if (isAndroid) {
			let storageLookupDismissal = localStorage.getItem(androidPopupDismissUntilStorage);
			if (storageLookupDismissal) {
				const dismissedUntil = Number(storageLookupDismissal);
				if (dismissedUntil > Date.now()) {
					showAndroidDownloadPopup = false;
				} else {
					showAndroidDownloadPopup = true;
				}
			} else {
				showAndroidDownloadPopup = true;
			}
		}
	});

	function dismissAndroidPopupFor24Hours() {
		const dismissUntil = Date.now() + oneWeekInMs;
		localStorage.setItem(androidPopupDismissUntilStorage, String(dismissUntil));
		localStorage.removeItem('androidPopupDismissed');
		localStorage.removeItem('androidPopupDismissed2');
		showAndroidDownloadPopup = false;
	}
</script>

{#if showAndroidDownloadPopup && isAndroid}
	<!-- Backdrop -->
	<div class="fixed inset-0 bg-black opacity-20 z-40"></div>

	<!-- Modal -->
	<div class="fixed inset-0 z-50 flex items-center justify-center dark:text-white">
		<div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl text-center w-11/12 max-w-sm">
			<h3 class="font-semibold leading-none dark:text-white text-lg mb-4">
				{$_('downloadandroid')}
			</h3>
			<p class="leading-none">
				{$_('downloadandroiddesc')}
			</p>
			<div class="flex justify-center gap-4 mt-3">
				<button
					on:click={dismissAndroidPopupFor24Hours}
					class="px-4 py-2 rounded-full font-semibold bg-transparent text-black dark:text-white border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
				>
					{$_('keepusingweb')}
				</button>
				<a
					href={isAndroid && isChrome
						? 'intent://#Intent;package=com.catenarymaps.catenary;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.catenarymaps.catenary;end'
						: 'https://play.google.com/store/apps/details?id=com.catenarymaps.catenary'}
					target="_blank"
					rel="noopener noreferrer"
					on:click={() => (showAndroidDownloadPopup = false)}
					class="px-4 py-2 rounded-full font-bold bg-blue-500 hover:bg-blue-700 text-white"
				>
					{$_('continue')}
				</a>
			</div>
		</div>
	</div>
{/if}
