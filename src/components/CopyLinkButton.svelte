<script lang="ts">
	import { _ } from 'svelte-i18n';

	/** The deep link screen type to navigate to */
	export let screen: 'stop' | 'route' | 'block';

	/** The chateau ID (data source identifier) */
	export let chateau: string;

	/** Stop ID - required when screen is 'stop' */
	export let stop: string | undefined = undefined;

	/** Route ID - required when screen is 'route' */
	export let route_id: string | undefined = undefined;

	/** Additional CSS classes to apply to the button */
	export let classNames: string = '';

	let copied = false;

	function buildShareUrl(): string {
		const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
		const params = new URLSearchParams({
			screen
		});

		if (chateau) params.set('chateau', chateau);
		if (stop) params.set('stop', stop);
		if (route_id) params.set('route_id', route_id);

		return `${baseUrl}/?${params.toString()}`;
	}

	async function handleCopy() {
		const url = buildShareUrl();
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}
</script>

<button
	on:click={handleCopy}
	class="text-seashore dark:text-seashoredark cursor-pointer mx-1 {classNames}"
	title={$_('copyLink')}
>
	{#if copied}
		<svg class="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<polyline points="20 6 9 17 4 12" />
		</svg>
	{:else}
		<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
			<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
		</svg>
	{/if}
</button>
