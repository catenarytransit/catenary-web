<script lang="ts">
	import type { ItinerarySegment } from '$lib/features/directions/edelweiss';
	import MtaBullet from '$components/mtabullet.svelte';
	import RatpBullet from '$components/ratpbullet.svelte';
	import SbbLogo from '$components/SbbLogo.svelte';

	export let segment: ItinerarySegment;
</script>

{#if segment.badgeName && segment.badgeKind === 'mta'}
	<MtaBullet route_short_name={segment.badgeName} matchTextHeight={true} />
{:else if segment.badgeName && segment.badgeKind === 'lametro'}
	<img class="inline-block h-[1.1em] w-[1.1em] shrink-0" src={`/lametro/LACMTA_Circle_${segment.badgeName.toUpperCase()}_Line.svg`} alt={`LA Metro ${segment.badgeName} Line`} />
{:else if segment.badgeName && segment.badgeKind === 'ratp'}
	<RatpBullet route_short_name={segment.badgeName} matchTextHeight={true} />
	{#if segment.routeName && segment.routeName !== segment.badgeName}
		<span class="ml-1 truncate">{segment.routeName}</span>
	{/if}
{:else}
	<span class="inline-flex max-w-full items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap px-1.5 py-0.5 text-xs font-semibold leading-none" class:rounded-full={segment.badgeKind === 'sbahn'} class:rounded-sm={segment.badgeKind !== 'sbahn'} style:background-color={segment.color} style:color={segment.textColor}>
		{#if segment.badgeKind === 'sbb' && segment.routeName}
			<SbbLogo text={segment.routeName} chateau="schweiz" />
		{:else}
			{segment.routeName || segment.mode}
		{/if}
	</span>
{/if}
