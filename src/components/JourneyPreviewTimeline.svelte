<script lang="ts">
	import { itineraryDisplaySegments, allocateTimelinePercentages, itineraryPreviewTimeGroups, formatJourneyDuration, formatWalkSegment, formatJourneyTime, formatRealtimeDelay, isStreetLeg, type EdelweissItinerary } from '$lib/features/directions/edelweiss';
	import JourneyRouteBadge from '$components/JourneyRouteBadge.svelte';

	export let itinerary: EdelweissItinerary;
	/** Keep the compact summary's clock order identical to the journey preview. */
	export let summary = false;
	let timelineWidth = 320;
	$: segments = itineraryDisplaySegments(itinerary);
	$: firstTransitLeg = itinerary.legs.find(leg => !isStreetLeg(leg.mode));
	$: departureDelay = formatRealtimeDelay(firstTransitLeg?.ServiceDeparture ?? firstTransitLeg?.from?.ServiceDeparture);
	$: widths = allocateTimelinePercentages(segments, timelineWidth);
	$: timeGroups = itineraryPreviewTimeGroups(itinerary);

	function measureTimeline(node: HTMLDivElement) {
		const measure = () => { timelineWidth = node.clientWidth || 320; };
		measure();
		const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
		observer?.observe(node);
		return { destroy() { observer?.disconnect(); } };
	}
</script>

<div class="min-w-0 w-full">
	<div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2" aria-label="Journey times">
		<div class="flex min-w-0 items-baseline justify-start gap-x-2.5 sm:gap-x-3">
			{#each timeGroups.departure as marker}
				<time datetime={marker.time} class={`shrink-0 whitespace-nowrap ${(marker.time === itinerary.startTime) ? 'text-sm font-bold' : 'text-xs font-normal text-gray-600 dark:text-gray-300'}`}>{formatJourneyTime(marker.time)}</time>
			{/each}
			{#if departureDelay && timeGroups.departure.some(marker => marker.transit)}
				<span data-testid="departure-delay" class="shrink-0 whitespace-nowrap text-xs font-medium tabular-nums text-amber-700 dark:text-amber-300">{departureDelay}</span>
			{/if}
		</div>
		<span class="shrink-0 whitespace-nowrap text-center text-xs font-medium text-gray-600 dark:text-gray-300">{formatJourneyDuration(itinerary)}</span>
		<div class="flex min-w-0 items-baseline justify-end gap-x-2.5 sm:gap-x-3">
			{#each timeGroups.arrival as marker}
				<time datetime={marker.time} class={`shrink-0 whitespace-nowrap ${(marker.time === itinerary.endTime) ? 'text-sm font-bold' : 'text-xs font-normal text-gray-600 dark:text-gray-300'}`}>{formatJourneyTime(marker.time)}</time>
			{/each}
		</div>
	</div>
				<div class="mt-3 w-full max-w-full" use:measureTimeline aria-label="Journey segments">
					<div class="flex w-full min-w-0 items-start overflow-hidden">
						{#each segments as segment, segmentIndex}
							<div class="min-w-0 shrink-0 overflow-hidden" style:width={`${widths[segmentIndex]}%`} role="group" aria-label={segment.transfer ? 'Transfer' : segment.walking ? `${segment.mode === 'BIKE' ? 'Cycle' : 'Walk'} ${formatWalkSegment(segment)}` : segment.routeName ? `${segment.mode} ${segment.routeName}` : segment.mode}>
								<div class="flex h-6 w-full min-w-0 items-center gap-1">
									{#if !segment.transfer}
										{#if segment.walking}
											<span class="material-symbols-outlined shrink-0 text-black dark:text-white" style:font-size="18px" aria-hidden="true">{segment.mode === 'BIKE' ? 'directions_bike' : 'directions_walk'}</span>
										{:else}
											<span class="sbb-mode-icon shrink-0 bg-black dark:bg-white" class:sbb-bus={segment.icon === 'bus'} class:sbb-metro={segment.icon === 'metro'} class:sbb-tram={segment.icon === 'tram'} class:sbb-train={segment.icon === 'train' || !segment.icon} aria-hidden="true"></span>
										{/if}
									{/if}
									{#if segment.walking && !segment.transfer}
										<span class="walking-dot-line min-w-0 flex-1" aria-hidden="true"></span>
									{:else}
										<span class="segment-bar min-w-0 flex-1" style:border-top-color={segment.transfer ? undefined : segment.walking ? undefined : /^(?:#000(?:000)?|#fff(?:fff)?)$/i.test(segment.color) ? undefined : segment.color} aria-hidden="true"></span>
									{/if}
								</div>
								{#if !segment.transfer}
									<div class="mt-1 flex min-h-5 w-full min-w-0 items-start justify-start overflow-hidden whitespace-nowrap text-xs" title={segment.walking ? formatWalkSegment(segment) : segment.routeName ?? segment.mode}>
										{#if segment.walking}
											<span class="truncate text-gray-600 dark:text-gray-300">{formatWalkSegment(segment)}</span>
										{:else}
											<JourneyRouteBadge {segment} compact />
										{/if}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>

</div>

<style>
	.segment-bar {
		border-top: 2px solid #9ca3af;
	}
	:global(.dark) .segment-bar {
		border-top-color: #6b7280;
	}
	.walking-dot-line {
		height: 4px;
		background-image: radial-gradient(circle, #9ca3af 1.6px, transparent 1.7px);
		background-size: 8px 4px;
		background-position: left center;
		background-repeat: repeat-x;
	}
	:global(.dark) .walking-dot-line {
		background-image: radial-gradient(circle, #6b7280 1.6px, transparent 1.7px);
	}
	.sbb-mode-icon {
		display: inline-block;
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		mask-position: center;
		mask-size: contain;
		mask-repeat: no-repeat;
		-webkit-mask-position: center;
		-webkit-mask-size: contain;
		-webkit-mask-repeat: no-repeat;
	}
	.sbb-bus {
		mask-image: url('/icons/bus-right-fill-color.svg');
		-webkit-mask-image: url('/icons/bus-right-fill-color.svg');
	}
	.sbb-metro {
		mask-image: url('/icons/metro-right-fill-color.svg');
		-webkit-mask-image: url('/icons/metro-right-fill-color.svg');
	}
	.sbb-train {
		mask-image: url('/icons/train-right-fill-color.svg');
		-webkit-mask-image: url('/icons/train-right-fill-color.svg');
	}
	.sbb-tram {
		mask-image: url('/icons/tram-right-fill-color.svg');
		-webkit-mask-image: url('/icons/tram-right-fill-color.svg');
	}

</style>
