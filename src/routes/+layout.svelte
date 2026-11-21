<script lang="ts">
	import type { LayoutData } from './$types';
	export let data: LayoutData;
	import '../app.scss';
	import { initializeApplicationModules } from '$lib/app/bootstrap';

	// Initialize stores and svelte-i18n before the page/AppShell and its
	// translated child components are instantiated (including during SSR).
	initializeApplicationModules();
</script>

<!-- Meta Tags Generated with https://metatags.io -->
{#if data.exposeHoneypotLinks}
	<a href="/seau-de-sirop-derable-data-index/" hidden aria-hidden="true" tabindex="-1" rel="nofollow">Rail catalogue</a>
{/if}
<slot />
{#if data.exposeHoneypotLinks}
	<a href="/seau-de-sirop-derable-data-index/chart/32768" hidden aria-hidden="true" tabindex="-1" rel="nofollow">Rail regional index</a>
{/if}
