<script lang="ts">
	export let route_short_name: string;
	export let matchTextHeight: boolean = false;

	let src: string | undefined;

	$: {
		let imageName = route_short_name.toLowerCase();
		if (imageName === 'gs') imageName = 's';
		if (imageName === 'fs') imageName = 'sf';
		if (imageName.endsWith('x')) {
			imageName = imageName.slice(0, -1) + 'd';
		}
		src = `/mtaicons/${imageName}.svg`;
	}
</script>

{#if src}
	<img
		class="inline-block"
		class:match-text-height={matchTextHeight}
		{src}
		alt={`MTA bullet for ${route_short_name}`}
	/>
{:else}
	<!-- Optionally, show the text as a fallback -->
	<span>{route_short_name}</span>
{/if}

<style>
	span {
		/* Style for fallback text if needed */
		font-weight: bold;
		padding: 0 0.2em;
	}
	.match-text-height {
		height: 1.1em;
		width: 1.1em;
		vertical-align: middle;
	}
	img:not(.match-text-height) {
		height: 1.25em;
		width: 1.25em;
		vertical-align: middle;
	}
</style>
