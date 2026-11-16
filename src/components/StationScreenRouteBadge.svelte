<script lang="ts">
	import SbbLogo from './SbbLogo.svelte';

	export let routeDef: any;
	export let chateau: string;
	export let remove_line: boolean = false;
	export let fallback_long_name: boolean = false;
	export let extra_classes: string = '';

	$: is_sbahn =
		['vbb', 'deutschland'].includes(chateau) &&
		(routeDef?.short_name || '').match(/^S\d+/) !== null;

	$: rounded_class = is_sbahn ? 'rounded-full' : 'rounded-xs';

	$: text = routeDef?.short_name
		? remove_line
			? routeDef.short_name.replace(' Line', '')
			: routeDef.short_name
		: fallback_long_name
			? routeDef?.long_name
			: '';

	// Reuse the LA Metro line circles already shown by journey planning. Only known
	// rail line letters have SVG assets; bus and unknown routes retain text badges.
	$: laMetroLine =
		chateau === 'metro~losangeles'
			? /^(?:([ABCDEK])(?:\s+Line)?)$/i.exec(text.trim())?.[1]?.toUpperCase()
			: undefined;

	$: isSbb =
		chateau === 'schweiz' && (text.startsWith('IR') || text.startsWith('IC') || text === 'EC');
</script>

{#if text}
	{#if laMetroLine}
		<img
			class="inline-block h-[20px] w-[20px] shrink-0 align-middle object-contain {extra_classes}"
			src={`/lametro/LACMTA_Circle_${laMetroLine}_Line.svg`}
			alt={`LA Metro ${laMetroLine} Line`}
		/>
	{:else if isSbb}
		<span
			class="{rounded_class} font-bold px-1 py-0.5 text-xs sbb-badge {extra_classes}"
			style={`background: ${routeDef?.color || '#eb0000'}; color: ${routeDef?.text_color || '#ffffff'};`}
		>
			<SbbLogo {text} {chateau} />
		</span>
	{:else}
		<span
			class="{rounded_class} font-bold px-1 py-0.5 text-xs {extra_classes}"
			style={`background: ${routeDef?.color}; color: ${routeDef?.text_color};`}
		>
			{text}
		</span>
	{/if}
{/if}

<style>
	span {
		display: inline-block;
	}

	.sbb-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		height: 18px;
	}
</style>
