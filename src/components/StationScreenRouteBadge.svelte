<script lang="ts">
	export let routeDef: any;
	export let chateau: string;
	export let remove_line: boolean = false;
	export let fallback_long_name: boolean = false;
	export let extra_classes: string = '';

	$: is_sbahn =
		['dbregioag', 'deutschland'].includes(chateau) &&
		(routeDef?.short_name || '').match(/^S\d+/) !== null;

	$: rounded_class = is_sbahn ? 'rounded-full' : 'rounded-xs';

	$: text = routeDef?.short_name
		? remove_line
			? routeDef.short_name.replace(' Line', '')
			: routeDef.short_name
		: fallback_long_name
			? routeDef?.long_name
			: '';
</script>

{#if text}
	<span
		class="{rounded_class} font-bold px-1 py-0.5 text-xs {extra_classes}"
		style={`background: ${routeDef?.color}; color: ${routeDef?.text_color};`}
	>
		{text}
	</span>
{/if}
