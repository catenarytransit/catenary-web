<script lang="ts">
	import { onMount } from 'svelte';
	export let url: string;
	export let title: string;
	let details: Record<string, string | null> | null = null;
	let failed = false;
	onMount(() => {
		const controller = new AbortController();
		fetch(url, { signal: controller.signal, headers: { Accept: 'application/geo+json' } })
			.then(response => {
				if (!response.ok) throw new Error('Alert unavailable');
				return response.json();
			})
			.then(data => { if (!controller.signal.aborted) details = data.properties; })
			.catch(() => { if (!controller.signal.aborted) failed = true; });
		return () => controller.abort();
	});
</script>

<section class="min-h-0 flex-1 overflow-y-auto px-4 py-3 select-text">
	<h1 class="mb-3 text-xl font-bold text-red-800 dark:text-red-300">{details?.event || title}</h1>
	{#if failed}
		<p role="alert">Unable to load weather alert details.</p>
	{:else if details}
		<p class="font-semibold">{details.headline || ''}</p>
		<dl class="my-3 space-y-1 text-sm">
			{#each [['Issued by', details.senderName], ['Affected area', details.areaDesc], ['Onset', details.onset], ['Ends', details.ends], ['Severity', details.severity], ['Urgency', details.urgency], ['Certainty', details.certainty]] as [label, value]}
				{#if value}<div><dt class="inline font-semibold">{label}: </dt><dd class="inline">{value}</dd></div>{/if}
			{/each}
		</dl>
		<p class="whitespace-pre-wrap">{details.description || ''}</p>
		{#if details.instruction}
			<h2 class="mt-4 font-bold">Instructions</h2>
			<p class="whitespace-pre-wrap">{details.instruction}</p>
		{/if}
	{:else}
		<p role="status">Loading weather alert…</p>
	{/if}
	<a class="mt-4 block underline" href={url} target="_blank" rel="noopener noreferrer">National Weather Service</a>
</section>
