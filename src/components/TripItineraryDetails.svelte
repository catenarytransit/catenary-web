<script lang="ts">
	import { onMount } from 'svelte';
	import {
		formatJourneyDuration,
		formatJourneyTime,
		isWalkingLeg,
		itinerarySegments,
		routeLabel,
		walkingLegDistanceMeters,
		type EdelweissItinerary,
		type EdelweissLeg
	} from '$lib/features/directions/edelweiss';

	export let itinerary: EdelweissItinerary;
	export let originName: string;
	export let destinationName: string;
	export let onBack: () => void;

	let backButton: HTMLButtonElement;
	$: segments = itinerarySegments(itinerary);

	onMount(() => backButton?.focus());

	function platform(leg: EdelweissLeg, end: 'from' | 'to'): string {
		const named = end === 'from' ? leg.fromPlatform : leg.toPlatform;
		const stop = leg[end];
		return named?.trim() || stop?.platform?.trim() || stop?.platformCode?.trim() || '—';
	}

	function placeName(leg: EdelweissLeg, end: 'from' | 'to', index: number): string {
		const fallback = end === 'from'
			? (index === 0 ? originName : 'Boarding stop')
			: (index === itinerary.legs.length - 1 ? destinationName : 'Alighting stop');
		return leg[end]?.name?.trim() || fallback;
	}

	function legTime(leg: EdelweissLeg, end: 'start' | 'end'): string {
		const time = end === 'start' ? leg.startTime || itinerary.startTime : leg.endTime || itinerary.endTime;
		return time && Number.isFinite(Date.parse(time)) ? formatJourneyTime(time) : '—';
	}

	function walkingTime(leg: EdelweissLeg): string {
		const seconds = leg.duration ?? (
			(Date.parse(leg.endTime ?? '') - Date.parse(leg.startTime ?? '')) / 1000
		);
		return `${Math.max(1, Math.round(Number.isFinite(seconds) ? seconds / 60 : 1))} min`;
	}

	function walkingDistance(leg: EdelweissLeg): string {
		const meters = walkingLegDistanceMeters(leg);
		if (meters === null || !Number.isFinite(meters)) return 'Distance unavailable';
		if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
		return `${Math.round(meters / 10) * 10} m`;
	}

	function walkLabel(index: number): string {
		const before = itinerary.legs.slice(0, index).some((leg) => !isWalkingLeg(leg.mode));
		const after = itinerary.legs.slice(index + 1).some((leg) => !isWalkingLeg(leg.mode));
		return before && after ? 'Walking transfer' : before ? 'Walk to destination' : 'Walk to departure';
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			onBack();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- The planner and its query results stay mounted underneath this local screen. -->
<div class="absolute inset-0 z-30 flex min-h-0 flex-col overflow-y-auto bg-gray-100 text-gray-900 dark:bg-black dark:text-white" role="region" aria-label="Journey details">
	<div class="sticky top-0 z-10 bg-gray-100 px-4 pb-3 pt-3 dark:bg-black">
		<button bind:this={backButton} type="button" on:click={onBack} class="mb-3 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 dark:hover:bg-gray-900" aria-label="Back to directions">
			<span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
			Directions
		</button>
		<section class="rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-sm dark:border-gray-200 dark:bg-white dark:text-gray-900" aria-label="Journey summary">
			<h2 class="break-words text-base font-semibold">{originName} <span aria-hidden="true">→</span> {destinationName}</h2>
			<div class="mt-3 flex items-center gap-3" aria-label="Departure and arrival times">
				<time class="shrink-0 text-sm font-semibold" datetime={itinerary.startTime}>{formatJourneyTime(itinerary.startTime)}</time>
				<div class="relative h-1 flex-1 rounded-full bg-gray-200" aria-hidden="true">
					<div class="absolute -top-1 left-0 h-3 w-3 rounded-full border-2 border-gray-500 bg-white"></div>
					<div class="absolute -top-1 right-0 h-3 w-3 rounded-full border-2 border-gray-500 bg-white"></div>
				</div>
				<time class="shrink-0 text-sm font-semibold" datetime={itinerary.endTime}>{formatJourneyTime(itinerary.endTime)}</time>
			</div>
			<p class="mt-3 text-sm font-medium text-gray-600">Total journey: {formatJourneyDuration(itinerary)}</p>
		</section>
	</div>

	<div class="flex flex-col gap-3 px-4 pb-8 pt-1" aria-label="Connections and transfers">
		{#each itinerary.legs as leg, index (index)}
			{#if isWalkingLeg(leg.mode)}
				<div class="rounded-xl border border-gray-400 bg-transparent px-4 py-3 text-gray-800 dark:border-gray-600 dark:text-white" aria-label={walkLabel(index)}>
					<div class="flex items-center gap-3">
						<span class="material-symbols-outlined text-xl" aria-hidden="true">directions_walk</span>
						<div class="min-w-0 flex-1">
							<p class="text-sm font-semibold">{walkLabel(index)}</p>
							<p class="mt-0.5 text-sm">{walkingTime(leg)} · {walkingDistance(leg)}</p>
						</div>
					</div>
					<p class="mt-2 pl-9 text-xs text-gray-600 dark:text-gray-400">{placeName(leg, 'from', index)} → {placeName(leg, 'to', index)}</p>
				</div>
			{:else}
				<article class="rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-sm dark:border-gray-200 dark:bg-white dark:text-gray-900" aria-label={`Connection ${index + 1}`}>
					<div class="mb-4 flex flex-wrap items-center gap-2">
						<span class="inline-flex max-w-full items-center rounded px-2 py-1 text-xs font-semibold" style:background-color={segments[index].color} style:color={segments[index].textColor}>{routeLabel(leg) || leg.mode}</span>
						<span class="min-w-0 truncate text-sm font-medium">{leg.routeLongName || leg.mode}</span>
					</div>
					<div class="mb-2 grid grid-cols-[3.5rem_1.25rem_minmax(0,1fr)_3.5rem] items-center gap-x-2 text-[10px] font-medium uppercase tracking-wide text-gray-500" aria-hidden="true">
						<span>Time</span><span></span><span>Stop</span><span class="text-right">Platform</span>
					</div>
					<div class="grid grid-cols-[3.5rem_1.25rem_minmax(0,1fr)_3.5rem] items-stretch gap-x-2">
						<time class="pt-0.5 text-sm font-semibold" datetime={leg.startTime || itinerary.startTime}>{legTime(leg, 'start')}</time>
						<div class="flex min-h-14 flex-col items-center" aria-hidden="true">
							<span class="h-3 w-3 shrink-0 rounded-full border-[3px] bg-white" style:border-color={segments[index].color}></span>
							<span class="my-0.5 w-0.5 flex-1 bg-gray-300"></span>
						</div>
						<div class="min-w-0 pb-4 text-sm font-medium">{placeName(leg, 'from', index)}</div>
						<div class="break-words pt-0.5 text-right text-xs text-gray-600" aria-label="Departure platform">{platform(leg, 'from')}</div>
						<time class="pt-0.5 text-sm font-semibold" datetime={leg.endTime || itinerary.endTime}>{legTime(leg, 'end')}</time>
						<div class="flex items-start justify-center" aria-hidden="true">
							<span class="h-3 w-3 shrink-0 rounded-full border-[3px] bg-white" style:border-color={segments[index].color}></span>
						</div>
						<div class="min-w-0 text-sm font-medium">{placeName(leg, 'to', index)}</div>
						<div class="break-words pt-0.5 text-right text-xs text-gray-600" aria-label="Arrival platform">{platform(leg, 'to')}</div>
					</div>
				</article>
			{/if}
		{:else}
			<p class="py-4 text-center text-sm text-gray-500 dark:text-gray-400">No leg details are available for this journey.</p>
		{/each}
	</div>
</div>
