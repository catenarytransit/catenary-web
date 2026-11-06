<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { dismissAppDownloadPopup, showIosDownloadPopup } from '$lib/app/state/overlays';
	const appStoreUrl = 'https://apps.apple.com/ca/app/catenary-maps/id6758525801';
</script>

{#if $showIosDownloadPopup}
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
					on:click={() => dismissAppDownloadPopup('ios')}
					class="px-4 py-2 rounded-full font-semibold bg-transparent text-black dark:text-white border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
				>
					{$_('keepusingweb')}
				</button>
				<a
					href={appStoreUrl}
					target="_blank"
					rel="noopener noreferrer"
					on:click={() => showIosDownloadPopup.set(false)}
					class="px-4 py-2 rounded-full font-bold bg-blue-500 hover:bg-blue-700 text-white"
				>
					{$_('continue')}
				</a>
			</div>
		</div>
	</div>
{/if}
