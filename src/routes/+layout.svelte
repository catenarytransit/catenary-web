<script>
	import '../app.scss';
	import { initializeApplicationModules } from '$lib/app/bootstrap';

	// Initialize stores and svelte-i18n before the page/AppShell and its
	// translated child components are instantiated (including during SSR).
	initializeApplicationModules();
</script>

<!-- Meta Tags Generated with https://metatags.io -->
<slot />
