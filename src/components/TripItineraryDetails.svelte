<script lang="ts">
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import JourneyPreviewTimeline from '$components/JourneyPreviewTimeline.svelte';
	import {
		formatJourneyDuration, formatJourneyTime, isWalkingLeg, itinerarySegments,
		routeLabel, walkingLegDistanceMeters,
		type EdelweissItinerary, type EdelweissLeg, type EdelweissIntermediateStop
	} from '$lib/features/directions/edelweiss';

	export let itinerary: EdelweissItinerary;
	export let originName: string;
	export let destinationName: string;
	export let onBack: () => void;

	let backButton: HTMLButtonElement;
	let expandedStops: Record<number, boolean> = {};
	$: segments = itinerarySegments(itinerary);

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

	function walkingMinutes(leg: EdelweissLeg): string {
		const computed = (Date.parse(leg.endTime ?? '') - Date.parse(leg.startTime ?? '')) / 1000;
		const seconds = Number.isFinite(leg.duration) ? leg.duration! : computed;
		return `${Math.max(1, Math.round(Number.isFinite(seconds) ? seconds / 60 : 1))}'`;
	}

	function walkingDistance(leg: EdelweissLeg): string {
		const meters = walkingLegDistanceMeters(leg);
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
			<JourneyPreviewTimeline {itinerary} summary showTransfers={false} />
			<p class="mt-3 text-sm font-medium text-gray-600 dark:text-gray-300">Total journey: {formatJourneyDuration(itinerary)}</p>
		</section>
	</div>

	<div class="flex flex-col gap-3 px-4 pb-8 pt-1" aria-label="Connections and transfers">
		{#each itinerary.legs as leg, index (index)}
			{#if isWalkingLeg(leg.mode)}
				<div class="rounded-xl border border-gray-400 bg-transparent px-4 py-3 text-gray-800 dark:border-gray-600 dark:text-white" aria-label="Walking connection">
					<div class="grid grid-cols-[3.5rem_1.25rem_minmax(0,1fr)_3.5rem] items-center gap-x-2">
						<span class="text-sm font-semibold tabular-nums">{walkingMinutes(leg)}</span>
						<div class="flex h-8 items-center justify-center" aria-hidden="true">
							<span class="h-6 border-l-2 border-dashed border-gray-500 dark:border-gray-400"></span>
						</div>
						<div class="min-w-0 text-sm font-medium">Walk</div>
						<div class="col-span-1 whitespace-nowrap text-right text-xs text-gray-600 dark:text-gray-300">Walk: {walkingDistance(leg)}</div>
					</div>
				</div>
			{:else}
				<article class="rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" aria-label={`Connection ${index + 1}`}>
					<div class="grid grid-cols-[3.5rem_1.25rem_minmax(0,1fr)_3.5rem] gap-x-2">
						<time class="pt-0.5 text-sm font-semibold tabular-nums leading-5" datetime={leg.startTime || itinerary.startTime}>{legTime(leg, 'start')}</time>
						<div class="relative flex justify-center pt-1" aria-hidden="true">
							<span class="absolute top-3 bottom-0 w-0.5 bg-gray-300 dark:bg-gray-600"></span>
							<span class="relative z-10 h-3 w-3 rounded-full border-[3px] bg-white dark:bg-gray-800" style:border-color={segments[index].color}></span>
						</div>
						<div class="min-w-0 pb-3 text-sm font-medium leading-5">{placeName(leg, 'from', index)}</div>
						<div class="break-words pt-0.5 text-right text-xs leading-5 text-gray-600 dark:text-gray-300">{platform(leg, 'from')}</div>

						<div></div>
						<div class="relative flex justify-center" aria-hidden="true"><span class="absolute inset-y-0 w-0.5 bg-gray-300 dark:bg-gray-600"></span></div>
						<div class="min-w-0 pb-2">
							<div class="flex flex-wrap items-center gap-2">
								<span class="inline-flex max-w-full items-center rounded px-1.5 py-0.5 text-xs font-semibold" style:background-color={segments[index].color} style:color={segments[index].textColor}>{routeLabel(leg) || leg.mode}</span>
								{#if leg.routeLongName}<span class="min-w-0 text-xs text-gray-600 dark:text-gray-300">{leg.routeLongName}</span>{/if}
							</div>
						</div>
						<div></div>

						{#if stops(leg).length > 0}
							<div></div>
							<div class="relative flex justify-center" aria-hidden="true"><span class="absolute inset-y-0 w-0.5 bg-gray-300 dark:bg-gray-600"></span></div>
							<button type="button" class="mb-2 flex w-full items-center justify-between gap-2 rounded py-1 text-left text-xs text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 dark:text-gray-300 dark:hover:bg-gray-700" aria-expanded={!!expandedStops[index]} on:click={() => toggleStops(index)}>
								<span>{stops(leg).length} {stops(leg).length === 1 ? 'stop' : 'stops'} · {Math.max(1, Math.round((leg.duration ?? ((Date.parse(leg.endTime ?? '') - Date.parse(leg.startTime ?? '')) / 1000)) / 60))} min</span>
								<span class="material-symbols-outlined text-base transition-transform" class:rotate-180={!!expandedStops[index]} aria-hidden="true">expand_more</span>
							</button>
							<div></div>
							{#if expandedStops[index]}
								{#each stops(leg) as stop, stopIndex (stopIndex)}
									<div transition:slide={{ duration: 180 }} class="pb-2 text-xs tabular-nums leading-5 text-gray-500 dark:text-gray-400">{stopTime(stop)}</div>
									<div class="relative flex justify-center" aria-hidden="true">
										<span class="absolute inset-y-0 w-0.5 bg-gray-300 dark:bg-gray-600"></span>
										<span class="relative z-10 mt-1.5 h-2 w-2 rounded-full border border-gray-400 bg-white dark:border-gray-400 dark:bg-gray-800"></span>
									</div>
									<div class="min-w-0 pb-2 text-xs leading-5 text-gray-500 dark:text-gray-400" transition:slide={{ duration: 180 }}>{stop.name}</div>
									<div class="pb-2 text-right text-xs text-gray-500 dark:text-gray-400" transition:slide={{ duration: 180 }}>{stop.platform || stop.platformCode || ''}</div>
								{/each}
							{/if}
						{/if}

						<time class="pt-0.5 text-sm font-semibold tabular-nums leading-5" datetime={leg.endTime || itinerary.endTime}>{legTime(leg, 'end')}</time>
						<div class="relative flex justify-center pt-1" aria-hidden="true">
							<span class="relative z-10 h-3 w-3 rounded-full border-[3px] bg-white dark:bg-gray-800" style:border-color={segments[index].color}></span>
						</div>
						<div class="min-w-0 text-sm font-medium leading-5">{placeName(leg, 'to', index)}</div>
						<div class="break-words pt-0.5 text-right text-xs leading-5 text-gray-600 dark:text-gray-300">{platform(leg, 'to')}</div>
					</div>
				</article>
			{/if}
		{:else}
			<p class="py-4 text-center text-sm text-gray-500 dark:text-gray-400">No leg details are available for this journey.</p>
		{/each}
	</div>
</div>
