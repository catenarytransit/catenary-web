<script lang="ts">
	import { itineraryDisplaySegments, allocateTimelinePercentages, itineraryTimeRow, formatWalkSegment, formatJourneyTime, type EdelweissItinerary } from '$lib/features/directions/edelweiss';
	import MtaBullet from '$components/mtabullet.svelte';
	import RatpBullet from '$components/ratpbullet.svelte';
	import SbbLogo from '$components/SbbLogo.svelte';

	export let itinerary: EdelweissItinerary;
	/** Summary uses just the two endpoint times; detailed duration is rendered below it. */
	export let summary = false;
	export let showTransfers = true;
	let timelineWidth = 320;
	$: segments = itineraryDisplaySegments(itinerary);
	$: widths = allocateTimelinePercentages(segments, timelineWidth);

	function measureTimeline(node: HTMLDivElement) {
		const measure = () => { timelineWidth = node.clientWidth || 320; };
		measure();
		const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
		observer?.observe(node);
		return { destroy() { observer?.disconnect(); } };
	}
</script>

<div class="min-w-0 w-full">
	{#if summary}
		<div class="flex justify-between gap-2 text-sm font-semibold" aria-label="Journey departure and arrival">
			<time datetime={itinerary.startTime}>{formatJourneyTime(itinerary.startTime)}</time>
			<time datetime={itinerary.endTime}>{formatJourneyTime(itinerary.endTime)}</time>
		</div>
	{:else}
				<div class="flex items-center justify-between gap-1.5 text-sm sm:text-base" aria-label="Journey departure, duration and arrival">
					{#each itineraryTimeRow(itinerary) as item}
						{#if item.kind === 'duration'}
							<span class="min-w-0 shrink text-center text-xs font-medium text-gray-600 dark:text-gray-300" aria-label="Total journey duration">{item.text}</span>
						{:else}
							<time datetime={item.time} class:font-semibold={item.transit} class:font-normal={!item.transit} class="shrink-0 whitespace-nowrap">{formatJourneyTime(item.time)}</time>
						{/if}
					{/each}
				</div>

	{/if}
				<div class="mt-3 w-full max-w-full" use:measureTimeline aria-label="Journey segments">
					<div class="flex w-full min-w-0 items-start overflow-hidden">
						{#each segments as segment, segmentIndex}
							<div class="min-w-0 shrink-0 overflow-visible" style:width={`${widths[segmentIndex]}%`} role="group" aria-label={segment.transfer ? 'Transfer' : segment.walking ? `Walk ${formatWalkSegment(segment)}` : segment.routeName ? `${segment.mode} ${segment.routeName}` : segment.mode}>
								<div class="flex h-6 w-full min-w-0 items-center gap-1">
									{#if !segment.transfer}
										{#if segment.walking}
											<span class="material-symbols-outlined shrink-0 text-black dark:text-white" style:font-size="18px" aria-hidden="true">directions_walk</span>
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
									<div class="mt-1 flex min-h-5 w-full min-w-0 items-start justify-start text-xs" title={segment.walking ? formatWalkSegment(segment) : segment.routeName ?? segment.mode}>
										{#if segment.walking}
											<span class="truncate text-gray-600 dark:text-gray-300">{formatWalkSegment(segment)}</span>
										{:else}
											{#if segment.routeName && segment.badgeKind === 'mta'}
												<MtaBullet route_short_name={segment.routeName} matchTextHeight={true} />
											{:else if segment.routeName && segment.badgeKind === 'ratp'}
												<RatpBullet route_short_name={segment.routeName} matchTextHeight={true} />
											{:else}
												<span class="inline-flex max-w-full items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap px-1.5 py-0.5 text-xs font-semibold leading-none" class:rounded-full={segment.badgeKind === 'sbahn'} class:rounded-sm={segment.badgeKind !== 'sbahn'} style:background-color={segment.color} style:color={segment.textColor}>
													{#if segment.badgeKind === 'sbb' && segment.routeName}
														<SbbLogo text={segment.routeName} chateau="schweiz" />
													{:else}
														{segment.routeName || segment.mode}
													{/if}
												</span>
											{/if}
										{/if}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>

	{#if showTransfers}
		<div class="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400"><span>{itinerary.transfers ?? 0} transfers</span></div>
	{/if}
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
