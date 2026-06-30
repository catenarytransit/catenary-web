<script lang="ts">
	import MtaBullet from '../mtabullet.svelte';
	import SbbLogo from '../SbbLogo.svelte';
	import {
		isSubwayRouteId,
		getMtaSubwayClass,
		getMtaSymbolShortName,
		isExpress,
		MTA_CHATEAU_ID
	} from '../../utils/mta_subway_utils';

	export let route: any; // TODO: Define a proper interface for RouteInfo

	export let chateau: string;
	export let route_id: string;

	$: bgColor = route.color;
	$: textColor = route.textColor;
	$: text = route.short_name || route.long_name || '';

	$: isSubway = isSubwayRouteId(route_id) && MTA_CHATEAU_ID == chateau;

	$: isSbb = chateau === 'schweiz' && (text.startsWith('IR') || text.startsWith('IC') || text === 'EC');
</script>

{#if isSubway}
	<MtaBullet route_short_name={route.short_name} matchTextHeight={true} />
{:else if isSbb}
	<div
		class="route-badge sbb-badge"
		style={`
			background-color: ${bgColor || '#eb0000'}; color: ${textColor || '#ffffff'};
		`}
	>
		<SbbLogo {text} {chateau} />
	</div>
{:else}
	<div
		class="route-badge"
		style={`
			background-color: ${bgColor}; color: ${textColor};
		`}
	>
		{text}
	</div>
{/if}

<style>
	.route-badge {
		display: inline-block;
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
		line-height: 1;
		transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.route-badge:hover {
		transform: scale(1.05);
	}

	.sbb-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 2px 6px;
		border-radius: 4px;
		height: 18px;
		box-sizing: border-box;
	}
</style>
