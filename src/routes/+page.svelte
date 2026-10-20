<script lang="ts">
	import AppShell from '$lib/app/AppShell.svelte';
	import type { PageData } from './$types';
	export let data: PageData;
</script>

<AppShell initialCenter={data.initialCenter} />
