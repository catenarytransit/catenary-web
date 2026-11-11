<script lang="ts">
	import type { ItinerarySegment } from '$lib/features/directions/edelweiss';
	import MtaBullet from '$components/mtabullet.svelte';
	import RatpBullet from '$components/ratpbullet.svelte';
	import SbbLogo from '$components/SbbLogo.svelte';

	export let segment: ItinerarySegment;
	/** Preview badges fade at the allocated right edge instead of wrapping or ellipsizing. */
	export let compact = false;

	function fadeWhenClipped(node: HTMLElement) {
		const update = () => node.classList.toggle('is-clipped', node.scrollWidth > node.clientWidth + 1);
		const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
		observer?.observe(node);
		update();
		return { destroy() { observer?.disconnect(); } };
	}
</script>

{#if segment.badgeName && segment.badgeKind === 'mta'}
	<MtaBullet route_short_name={segment.badgeName} matchTextHeight={true} />
{:else if segment.badgeName && segment.badgeKind === 'lametro'}
	<img class="inline-block h-[1.1em] w-[1.1em] shrink-0" src={`/lametro/LACMTA_Circle_${segment.badgeName.toUpperCase()}_Line.svg`} alt={`LA Metro ${segment.badgeName} Line`} />
{:else if segment.badgeName && segment.badgeKind === 'ratp'}
	<RatpBullet route_short_name={segment.badgeName} matchTextHeight={true} />
	{#if segment.routeName && segment.routeName !== segment.badgeName}
		<span use:fadeWhenClipped class="ml-1 min-w-0" class:compact-fade={compact}>{segment.routeName}</span>
	{/if}
{:else}
	<span class="inline-flex max-w-full min-w-0 items-center justify-center overflow-hidden whitespace-nowrap px-1.5 py-0.5 text-xs font-semibold leading-none" use:fadeWhenClipped class:compact-fade={compact} class:text-ellipsis={!compact} class:rounded-full={segment.badgeKind === 'sbahn'} class:rounded-sm={segment.badgeKind !== 'sbahn'} style:background-color={segment.color} style:color={segment.textColor}>
		{#if segment.badgeKind === 'sbb' && segment.routeName}
			<SbbLogo text={segment.routeName} chateau="schweiz" />
		{:else}
			{segment.routeName || segment.mode}
		{/if}
	</span>
{/if}

<style>
	/* Fade clipped content only on the compact preview; full detail badges are unchanged. */
	.compact-fade {
		display: inline-block;
		min-width: 0;
		max-width: 100%;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: clip;

	}
	.compact-fade.is-clipped {
		-webkit-mask-image: linear-gradient(to right, black 0%, black calc(100% - 12px), transparent 100%);
		mask-image: linear-gradient(to right, black 0%, black calc(100% - 12px), transparent 100%);
	}
</style>
