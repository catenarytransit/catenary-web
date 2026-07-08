<script lang="ts">
	import SbbLogo from './SbbLogo.svelte';

	export let routeDef: any;
	export let chateau: string;
	export let remove_line: boolean = false;
	export let fallback_long_name: boolean = false;
	export let extra_classes: string = '';

	export let text_size_class: string = 'text-sm';

	export let db_train_data: any = null;

	import { MTA_CHATEAU_ID, isSubwayRouteId } from '../utils/mta_subway_utils';
	import { IDFM_CHATEAU_ID, isRatpRoute } from '../utils/ratp_utils';
	import MtaBullet from './mtabullet.svelte';
	import RatpBullet from './ratpbullet.svelte';

	$: is_sbahn =
		['dbregioag', 'deutschland'].includes(chateau) &&
		(routeDef?.short_name || '').match(/^S\d+/) !== null;

	$: rounded_class = is_sbahn ? 'rounded-full' : 'rounded-sm';

	$: text = routeDef?.short_name
		? remove_line
			? routeDef.short_name.replace(' Line', '')
			: routeDef.short_name
		: fallback_long_name
			? routeDef?.long_name
			: '';

	$: isSbb = chateau === 'schweiz' && (text.startsWith('IR') || text.startsWith('IC') || text === 'EC');

	$: db_route_short_name = db_train_data ? db_train_data[0].category + (fallback_long_name ? "-Linie " + routeDef.short_name : "") : routeDef.short_name;

	$: isSubway = routeDef.chateau === MTA_CHATEAU_ID && isSubwayRouteId(routeDef.route_id);
	$: isRatp = routeDef.chateau === IDFM_CHATEAU_ID && isRatpRoute(routeDef.short_name);
</script>

{#if text}
	{#if isSubway && routeDef.short_name}
		<MtaBullet route_short_name={routeDef.short_name} matchTextHeight={true} />
	{:else if isRatp && routeDef.short_name}
		<RatpBullet route_short_name={routeDef.short_name} matchTextHeight={true} />
	{:else if isSbb}
		<span
			class="{rounded_class} font-bold px-1 py-0.5 {text_size_class} sbb-badge {extra_classes}"
			style={`background: ${routeDef?.color || '#eb0000'}; color: ${routeDef?.text_color || '#ffffff'};`}
		>
			<SbbLogo {text} {chateau} />
		</span>
	{:else if db_train_data}
		<span
			class="{rounded_class} font-bold px-1 py-0.5 {text_size_class} bg-gray-200 dark:bg-gray-700 {extra_classes}"
		>
			{db_route_short_name}
		</span>
	{:else}
		<span
			class="{rounded_class} font-bold px-1 py-0.5 {text_size_class} {extra_classes}"
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
