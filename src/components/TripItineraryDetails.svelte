<script lang="ts">
	import { onMount } from 'svelte';
	import JourneyPreviewTimeline from '$components/JourneyPreviewTimeline.svelte';
	import {
		formatJourneyTime, isStreetLeg, itinerarySegments, itineraryDetailLegs,
		routeLabel,
		type EdelweissItinerary, type EdelweissLeg, type EdelweissIntermediateStop
	} from '$lib/features/directions/edelweiss';
	import { connectionRailColor } from '$lib/features/directions/connectionRailColor';

	export let itinerary: EdelweissItinerary;
	export let originName: string;
	export let destinationName: string;
	export let onBack: () => void;

	let backButton: HTMLButtonElement;
	let expandedStops: Record<number, boolean> = {};
	$: segments = itinerarySegments(itinerary);
	$: detailLegs = itineraryDetailLegs(itinerary);

	onMount(() => backButton?.focus());

	function platform(leg: EdelweissLeg, end: 'from' | 'to'): string {
		const named = end === 'from' ? leg.fromPlatform : leg.toPlatform;
		const stop = leg[end];
		return named?.trim() || stop?.platform?.trim() || stop?.platformCode?.trim() || '';
	}

	function placeName(leg: EdelweissLeg, end: 'from' | 'to', index: number): string {
		const fallback = end === 'from'
			? (index === 0 ? originName : 'Boarding stop')
			: (index === itinerary.legs.length - 1 ? destinationName : 'Alighting stop');
		return leg[end]?.name?.trim() || fallback;
	}

	function legTime(leg: EdelweissLeg, end: 'start' | 'end'): string {
		return displayTime(end === 'start' ? leg.startTime || itinerary.startTime : leg.endTime || itinerary.endTime);
	}

	function displayTime(time: string | null | undefined): string {
		return time && Number.isFinite(Date.parse(time)) ? formatJourneyTime(time) : '';
	}

	function walkingMinutes(seconds: number | null): string {
		return seconds === null ? '—' : `${Math.max(1, Math.round(seconds / 60))}'`;
	}

	function walkingDistance(meters: number | null): string {
		if (meters === null || !Number.isFinite(meters)) return 'distance unavailable';
		return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
	}

	function stopTime(stop: EdelweissIntermediateStop): string {
		return displayTime(stop.departure || stop.arrival || stop.scheduledDeparture || stop.scheduledArrival);
	}

	function stops(leg: EdelweissLeg): EdelweissIntermediateStop[] {
		return Array.isArray(leg.intermediateStops) ? leg.intermediateStops : [];
	}

	function toggleStops(index: number): void {
		expandedStops = { ...expandedStops, [index]: !expandedStops[index] };
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			onBack();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="absolute inset-0 z-30 flex min-h-0 flex-col overflow-y-auto bg-gray-100 text-gray-900 dark:bg-black dark:text-white" role="region" aria-label="Journey details">
	<div class="sticky top-0 z-10 bg-gray-100 px-4 pb-3 pt-3 dark:bg-black">
		<button bind:this={backButton} type="button" on:click={onBack} class="mb-3 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 dark:hover:bg-gray-900" aria-label="Back to directions">
			<span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
			Directions
		</button>
		<section class="rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" aria-label="Journey summary">
			<h2 class="mb-3 break-words text-base font-semibold">{originName} <span aria-hidden="true">→</span> {destinationName}</h2>
			<JourneyPreviewTimeline {itinerary} summary />
		</section>
	</div>

	<div class="flex flex-col gap-3 px-4 pb-8 pt-1" aria-label="Connections and transfers">
		<div class="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" aria-label="Journey origin">
			<div class="connection-row">
				<span></span>
				<span class="pearl-rail rail-first" aria-hidden="true"><span class="pearl"></span></span>
				<span class="min-w-0 break-words text-left text-sm font-semibold leading-5">{originName}</span>
				<span></span>
			</div>
		</div>
		{#each detailLegs as detail (detail.sourceIndex)}
			{@const leg = detail.leg}
			{@const index = detail.sourceIndex}
			{#if isStreetLeg(leg.mode)}
				<div class="rounded-xl border border-gray-400 bg-transparent px-4 py-3 text-gray-800 dark:border-gray-600 dark:text-white" aria-label="Walking connection">
					<div class="connection-row">
						<span class="text-right text-sm font-semibold tabular-nums">{walkingMinutes(detail.walkingSeconds)}</span>
						<span class="pearl-rail walk-rail" aria-hidden="true"></span>
						<span class="min-w-0 text-left text-sm font-medium">{leg.mode.toUpperCase() === 'BIKE' ? 'Cycle' : 'Walk'}: {walkingDistance(detail.walkingMeters)}</span>
						<span></span>
					</div>
				</div>
			{:else}
				<article class="rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" aria-label={'Connection ' + (index + 1)} style={`--rail-light: ${connectionRailColor(leg.routeColor, false)}; --rail-dark: ${connectionRailColor(leg.routeColor, true)};`}>
					<!-- Contiguous rows give the pearl string no gaps; left and right gutters match. -->
					<div class="connection-row">
						<time class="min-w-0 text-right text-sm font-semibold tabular-nums leading-5" datetime={leg.startTime || itinerary.startTime}>{legTime(leg, 'start')}</time>
						<span class="pearl-rail rail-first" aria-hidden="true"><span class="pearl"></span></span>
						<span class="min-w-0 text-left text-sm font-medium leading-5">{placeName(leg, 'from', index)}</span>
						<span class="min-w-0 break-words text-right text-xs text-gray-600 dark:text-gray-300">{platform(leg, 'from')}</span>
					</div>

					<div class="connection-row">
						<span></span>
						<span class="pearl-rail" aria-hidden="true"></span>
						<div class="flex min-w-0 flex-wrap items-center gap-2 py-1">
							<span class="connection-mode-icon" class:mode-bus={segments[index].icon === 'bus'} class:mode-metro={segments[index].icon === 'metro'} class:mode-tram={segments[index].icon === 'tram'} class:mode-train={segments[index].icon === 'train'} aria-label={leg.mode}></span>
							<span class="inline-flex max-w-full items-center rounded px-1.5 py-0.5 text-xs font-semibold" style:background-color={segments[index].color} style:color={segments[index].textColor}>{routeLabel(leg) || leg.mode}</span>
							{#if leg.routeLongName}<span class="min-w-0 text-xs text-gray-600 dark:text-gray-300">{leg.routeLongName}</span>{/if}
						</div>
						<span></span>
					</div>

					{#if stops(leg).length > 0}
						<!-- The click target spans the entire card, not just the stop-name column. -->
						<button type="button" class="connection-row w-full rounded py-1 text-left text-xs text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 dark:text-gray-300 dark:hover:bg-gray-700" aria-expanded={!!expandedStops[index]} aria-label={(expandedStops[index] ? 'Hide ' : 'Show ') + stops(leg).length + ' intermediate stops'} on:click={() => toggleStops(index)}>
							<span></span>
							<span class="pearl-rail" aria-hidden="true"></span>
							<span class="min-w-0 text-left">{stops(leg).length} {stops(leg).length === 1 ? 'stop' : 'stops'} · {Math.max(1, Math.round((leg.duration ?? ((Date.parse(leg.endTime ?? '') - Date.parse(leg.startTime ?? '')) / 1000)) / 60))} min</span>
							<span class="material-symbols-outlined justify-self-end text-base transition-transform" class:rotate-180={!!expandedStops[index]} aria-hidden="true">expand_more</span>
						</button>
						{#if expandedStops[index]}
							{#each stops(leg) as stop, stopIndex (stopIndex)}
								<div class="connection-row">
									<span class="min-w-0 text-right text-xs tabular-nums leading-5 text-gray-500 dark:text-gray-400">{stopTime(stop)}</span>
									<span class="pearl-rail" aria-hidden="true"><span class="pearl"></span></span>
									<span class="min-w-0 text-left text-xs leading-5 text-gray-500 dark:text-gray-400">{stop.name}</span>
									<span class="min-w-0 text-right text-xs text-gray-500 dark:text-gray-400">{stop.platform || stop.platformCode || ''}</span>
								</div>
							{/each}
						{/if}
					{/if}

					<div class="connection-row">
						<time class="min-w-0 text-right text-sm font-semibold tabular-nums leading-5" datetime={leg.endTime || itinerary.endTime}>{legTime(leg, 'end')}</time>
						<span class="pearl-rail rail-last" aria-hidden="true"><span class="pearl"></span></span>
						<span class="min-w-0 text-left text-sm font-medium leading-5">{placeName(leg, 'to', index)}</span>
						<span class="min-w-0 break-words text-right text-xs text-gray-600 dark:text-gray-300">{platform(leg, 'to')}</span>
					</div>
				</article>
			{/if}
		{:else}
			<p class="py-4 text-center text-sm text-gray-500 dark:text-gray-400">No leg details are available for this journey.</p>
		{/each}
		<div class="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" aria-label="Journey destination">
			<div class="connection-row">
				<span></span>
				<span class="pearl-rail rail-last" aria-hidden="true"><span class="pearl"></span></span>
				<span class="min-w-0 break-words text-left text-sm font-semibold leading-5">{destinationName}</span>
				<span></span>
			</div>
		</div>
	</div>
</div>

<style>
	/* Identical gutters beside the fixed-width pearl column put time and stop
	   text equally far from the dot, even when a stop name wraps. */
	.connection-row {
		display: grid;
		grid-template-columns: 3.5rem 1.25rem minmax(0, 1fr) 4.5rem;
		column-gap: 0.75rem;
		align-items: center;
		min-height: 2.5rem;
	}
	.pearl-rail {
		position: relative;
		align-self: stretch;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100%;
	}
	.pearl-rail::before {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: 2px;
		background: var(--rail-light, #000);
		transform: translateX(-50%);
	}
	:global(.dark) .pearl-rail::before { background: var(--rail-dark, #fff); }
	.rail-first::before { top: 50%; }
	.rail-last::before { bottom: 50%; }
	.pearl {
		position: relative;
		z-index: 1;
		display: block;
		width: 8px;
		height: 8px;
		flex: none;
		border-radius: 50%;
		background: #000;
	}
	:global(.dark) .pearl { background: #fff; }
	/* Round dots rather than dash-shaped segments for walking connections. */
	.walk-rail::before {
		width: 4px;
		background: radial-gradient(circle, #64748b 1.2px, transparent 1.3px) center top / 4px 7px repeat-y;
	}
	:global(.dark) .walk-rail::before {
		background: radial-gradient(circle, #9ca3af 1.2px, transparent 1.3px) center top / 4px 7px repeat-y;
	}
	.connection-mode-icon {
		display: inline-block;
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		background-color: #111827;
		mask-position: center;
		mask-size: contain;
		mask-repeat: no-repeat;
		-webkit-mask-position: center;
		-webkit-mask-size: contain;
		-webkit-mask-repeat: no-repeat;
	}
	:global(.dark) .connection-mode-icon { background-color: #fff; }
	.mode-bus { mask-image: url('/icons/bus-right-fill-color.svg'); -webkit-mask-image: url('/icons/bus-right-fill-color.svg'); }
	.mode-metro { mask-image: url('/icons/metro-right-fill-color.svg'); -webkit-mask-image: url('/icons/metro-right-fill-color.svg'); }
	.mode-tram { mask-image: url('/icons/tram-right-fill-color.svg'); -webkit-mask-image: url('/icons/tram-right-fill-color.svg'); }
	.mode-train { mask-image: url('/icons/train-right-fill-color.svg'); -webkit-mask-image: url('/icons/train-right-fill-color.svg'); }
	@media (max-width: 360px) {
		.connection-row { grid-template-columns: 3.5rem 1.25rem minmax(0, 1fr) 3rem; column-gap: 0.5rem; }
	}
</style>
