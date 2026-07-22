<script lang="ts">
	import { _ } from 'svelte-i18n';
	import TimeDiff from './TimeDiff.svelte';
	import DelayDiff from './DelayDiff.svelte';
	import BullseyeArrow from './svg_icons/bullseye_arrow.svelte';
	import Clock from './Clock.svelte';
	import Realtimeicon from './svg_icons/realtimeicon.svelte';
	import { onMount } from 'svelte';

	export let show_seconds: boolean = false;
	export let trip_data: any;
	export let stoptime: any;
	export let current_time: number;

	export let variant: 'default' | 'sidebar' = 'default';
	export let display_type: 'auto' | 'arrival' | 'departure' = 'auto';

	$: current_time_secs = Math.floor(current_time / 1000);

	let show_both_departure_and_arrival = calculate_show_both_departure_and_arrival();

	let debug_mode = false;

	$: shared_rt_time = stoptime.rt_departure_time || stoptime.rt_arrival_time;

	$: shared_scheduled_time =
		stoptime.scheduled_departure_time_unix_seconds ||
		stoptime.scheduled_arrival_time_unix_seconds ||
		stoptime.interpolated_stoptime_unix_seconds;

	onMount(() => {
		show_both_departure_and_arrival = calculate_show_both_departure_and_arrival();
	});

	function calculate_show_both_departure_and_arrival(): boolean {
		//if has 2 different scheduled timestamps

		if (
			stoptime.scheduled_departure_time_unix_seconds &&
			stoptime.scheduled_arrival_time_unix_seconds
		) {
			if (
				stoptime.scheduled_departure_time_unix_seconds !=
				stoptime.scheduled_arrival_time_unix_seconds
			) {
				return true;
			}
		}

		if (stoptime.rt_departure_time && stoptime.rt_arrival_time) {
			if (stoptime.rt_departure_time != stoptime.rt_arrival_time) {
				return true;
			}
		}

		return false;
	}
</script>

{#if shared_scheduled_time || shared_rt_time}
	{#if show_both_departure_and_arrival}
		<!--ARRIVAL SECTION-->
		{#if display_type === 'auto' || display_type === 'arrival'}
			<div
				class={`flex ${variant === 'sidebar' ? 'flex-col-reverse items-end' : 'flex-row items-center space-x-1'}`}
			>
				{#if variant !== 'sidebar'}
					<TimeDiff
						diff={(stoptime.rt_arrival_time || stoptime.scheduled_arrival_time_unix_seconds) -
							current_time_secs}
						{show_seconds}
						show_brackets={false}
					/>
				{/if}
				{#if stoptime.rt_arrival_time}
					{#if stoptime.scheduled_arrival_time_unix_seconds || stoptime.interpolated_stoptime_unix_seconds}
						<DelayDiff
							diff={stoptime.rt_arrival_time -
								(stoptime.scheduled_arrival_time_unix_seconds ||
									stoptime.interpolated_stoptime_unix_seconds)}
							{show_seconds}
							textclass={'text-[0px] leading-tight'}
							alltextclass={'leading-tight'}
							use_ticks={true}
						/>
					{/if}
				{/if}

				<div class={`${variant === 'sidebar' ? '' : 'ml-auto'} text-sm`}>
					<div class="text-sm text-right">
						<p class="text-right">
							{#if variant !== 'sidebar'}
								<span
									class="text-xs align-middle mr-1 inline-block -translate-y-0.5 text-gray-600 dark:text-gray-400"
								>
									{$_('arrival')}</span
								>
							{/if}

							{#if stoptime.rt_arrival_time}
								{#if stoptime.rt_arrival_time == stoptime.scheduled_arrival_time_unix_seconds}
									{#if variant !== 'sidebar'}
										<BullseyeArrow class_name="w-4 h-4 inline-block align-middle text-[#58A738]" />
									{/if}
								{/if}
								{#if stoptime.rt_arrival_time != stoptime.scheduled_arrival_time_unix_seconds}
									{#if stoptime.scheduled_arrival_time_unix_seconds || stoptime.interpolated_stoptime_unix_seconds}
										<!-- Strikethrough time removed -->
									{/if}
								{/if}
								<br class={variant === 'sidebar' ? 'block' : 'hidden'} />
								<span class="font-medium leading-tight">
									<Clock
										timezone={stoptime.timezone || trip_data.tz}
										time_seconds={stoptime.rt_arrival_time}
										{show_seconds}
									/>
								</span>
							{:else}
								<span class="leading-tight">
									<Clock
										timezone={stoptime.timezone || trip_data.tz}
										time_seconds={stoptime.scheduled_arrival_time_unix_seconds ||
											stoptime.interpolated_stoptime_unix_seconds}
										{show_seconds}
									/>
								</span>
							{/if}
						</p>
					</div>
				</div>
			</div>
		{/if}

		<!--DEPARTURE SECTION-->
		{#if display_type === 'auto' || display_type === 'departure'}
			<div
				class={`flex ${variant === 'sidebar' ? 'flex-col-reverse items-end' : 'flex-row items-center space-x-1'}`}
			>
				{#if variant !== 'sidebar'}
					<TimeDiff
						diff={(stoptime.rt_departure_time || stoptime.scheduled_departure_time_unix_seconds) -
							current_time_secs}
						{show_seconds}
						show_brackets={false}
					/>
				{/if}
				{#if stoptime.rt_departure_time}
					{#if stoptime.scheduled_departure_time_unix_seconds || stoptime.interpolated_stoptime_unix_seconds}
						<DelayDiff
							diff={stoptime.rt_departure_time -
								(stoptime.scheduled_departure_time_unix_seconds ||
									stoptime.interpolated_stoptime_unix_seconds)}
							{show_seconds}
							alltextclass={'leading-tight'}
							textclass={'text-[0px] leading-tight'}
						/>
					{/if}
				{/if}

				<div class={`${variant === 'sidebar' ? '' : 'ml-auto'} text-sm`}>
					<div class="text-sm text-right">
						<p class="text-right">
							{#if variant !== 'sidebar'}
								<span
									class="text-xs align-middle mr-1 inline-block -translate-y-0.5 text-gray-600 dark:text-gray-400"
								>
									{$_('departure')}</span
								>
							{/if}

							{#if stoptime.rt_departure_time}
								{#if stoptime.rt_departure_time == stoptime.scheduled_departure_time_unix_seconds}
									{#if variant !== 'sidebar'}
										<BullseyeArrow class_name="w-4 h-4 inline-block align-middle text-[#58A738]" />
									{/if}
								{/if}
								{#if stoptime.rt_departure_time != stoptime.scheduled_departure_time_unix_seconds}
									<!-- Strikethrough time removed -->
								{/if}
								<br class={variant === 'sidebar' ? 'block' : 'hidden'} />
								<span class="font-bold leading-tight">
									<Clock
										timezone={stoptime.timezone || trip_data.tz}
										time_seconds={stoptime.rt_departure_time}
										{show_seconds}
									/>
								</span>
							{:else}
								<span class="font-bold leading-tight">
									<Clock
										timezone={stoptime.timezone || trip_data.tz}
										time_seconds={stoptime.scheduled_departure_time_unix_seconds ||
											stoptime.interpolated_stoptime_unix_seconds}
										{show_seconds}
									/>
								</span>
							{/if}
						</p>
					</div>
				</div>
			</div>
		{/if}
	{:else}
		<!--UNIFIED TIME-->
		{#if display_type === 'auto' || display_type === 'departure'}
			<div
				class={`flex ${variant === 'sidebar' ? 'flex-col-reverse items-end' : 'flex-row items-center space-x-1'} leading-tight`}
			>
				{#if variant !== 'sidebar'}
					{#if shared_rt_time || shared_scheduled_time}
						<TimeDiff
							diff={(shared_rt_time || shared_scheduled_time) - current_time_secs}
							{show_seconds}
							show_brackets={false}
						/>
					{/if}
					{#if shared_rt_time && shared_scheduled_time}
						{#if shared_scheduled_time != 0 && shared_scheduled_time != null}
							<DelayDiff
								diff={shared_rt_time - shared_scheduled_time}
								{show_seconds}
								alltextclass={'leading-tight'}
								textclass={'text-[0px] leading-tight'}
							/>
						{/if}
					{/if}
				{/if}
				<div class={`${variant === 'sidebar' ? '' : 'ml-auto'} text-sm`}>
					<div class="text-sm text-right leading-tight">
						<p class="text-right leading-tight">
							{#if shared_rt_time}
								{#if shared_rt_time == shared_scheduled_time}
									{#if variant !== 'sidebar'}
										<BullseyeArrow class_name="w-4 h-4 inline-block text-[#58A738]" />
									{/if}
								{/if}
								{#if shared_rt_time != shared_scheduled_time}{/if}
								{#if shared_scheduled_time}
									{#if shared_rt_time != shared_scheduled_time}
										<!-- Strikethrough time removed -->
									{/if}
								{/if}
								<br class={variant === 'sidebar' ? 'block' : 'hidden'} />
								<span class="font-bold leading-tight">
									<Clock
										timezone={stoptime.timezone || trip_data.tz}
										time_seconds={shared_rt_time}
										{show_seconds}
									/>
								</span>
							{:else if shared_scheduled_time}
								<span class="font-bold leading-tight">
									<Clock
										timezone={stoptime.timezone || trip_data.tz}
										time_seconds={shared_scheduled_time}
										{show_seconds}
									/>
								</span>
							{/if}
						</p>
					</div>
				</div>
			</div>
		{/if}
	{/if}
{/if}

{#if debug_mode}<p>
		<span class="text-sm">shared time rt:{shared_rt_time} | sched: {shared_scheduled_time}</span>
	</p>{/if}
