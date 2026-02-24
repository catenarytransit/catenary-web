<script lang="ts">
	import TimeDiff from './TimeDiff.svelte';

	import BullseyeArrow from './svg_icons/bullseye_arrow.svelte';
	import DelayDiff from './DelayDiff.svelte';
	import { _ } from 'svelte-i18n';
	import Clock from './Clock.svelte';

	export let event: any;
	export let timezone: string;
	export let current_time: number;
	export let show_seconds: boolean;
	export let show_arrivals: boolean = false;
	export let vertical: boolean = false;
	export let use_symbol_sign: boolean = false;

	$: shared_rt_time = show_arrivals ? event.realtime_arrival : event.realtime_departure;

	$: shared_scheduled_time = show_arrivals ? event.scheduled_arrival : event.scheduled_departure;
</script>

<div class={`flex flex-row`}>
	{#if event.trip_cancelled}
		<div class="flex flex-col w-full">
			<span class="text-red-500 font-semibold">{$_('cancelled')}</span>
			<div class="line-through opacity-70">
				<Clock {timezone} time_seconds={shared_scheduled_time} {show_seconds} />
			</div>
		</div>
	{:else if event.trip_deleted}
		<div class="flex flex-col w-full">
			<span class="text-red-500 font-semibold">{$_('deleted')}</span>
			<div class="line-through opacity-70">
				<Clock {timezone} time_seconds={shared_scheduled_time} {show_seconds} />
			</div>
		</div>
	{:else if event.stop_cancelled}
		<div class="flex flex-col w-full">
			<span class="text-red-500 font-semibold">{$_('stop_cancelled')}</span>
			<div class="line-through opacity-70">
				<Clock {timezone} time_seconds={shared_scheduled_time} {show_seconds} />
			</div>
		</div>
	{:else}
		{#if shared_rt_time}
			<div class="flex flex-col">
				<!-- Horizontal Mode -->
				<div class="flex flex-row items-center">
					<span
						class={`font-medium ${shared_rt_time < current_time / 1000 ? 'opacity-70' : ''} font-medium`}
					>
						<Clock {timezone} time_seconds={shared_rt_time} {show_seconds} />
					</span>
				</div>
			</div>
		{:else}
			<div class={`${shared_scheduled_time < current_time / 1000 ? 'opacity-70' : ''} font-medium`}>
				<Clock {timezone} time_seconds={shared_scheduled_time} {show_seconds} />
			</div>
		{/if}

		<span class="ml-1">
			{#if shared_rt_time}
				{#if shared_scheduled_time}
					<DelayDiff
						diff={shared_rt_time - shared_scheduled_time}
						{show_seconds}
						{use_symbol_sign}
					/>
				{/if}
			{/if}
		</span>

		<div class="ml-auto">
			{#if shared_rt_time || shared_scheduled_time}
				{@const timeDiffAmount = (shared_rt_time || shared_scheduled_time) - current_time / 1000}

				{#if Math.abs(timeDiffAmount) <= 3600}
					<TimeDiff large={false} show_brackets={false} {show_seconds} diff={timeDiffAmount} />
				{/if}
			{/if}
		</div>
	{/if}
</div>
