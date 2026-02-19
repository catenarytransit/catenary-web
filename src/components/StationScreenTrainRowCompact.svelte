<script lang="ts">
	import TimeDiff from './TimeDiff.svelte';

	import BullseyeArrow from './svg_icons/bullseye_arrow.svelte';
	import DelayDiff from './DelayDiff.svelte';
	import { _ } from 'svelte-i18n';
	import Clock from './Clock.svelte';
	import { SingleTrip, StackInterface } from './stackenum';
	import { data_stack_store } from '../globalstores';

	export let event: any;
	export let data_from_server: any;
	export let current_time: number;
	export let show_seconds: boolean;
	export let use_symbol_sign: boolean = false;
	export let timezone: string = 'UTC';
	export let show_timediff: boolean = true;
	export let show_agency_name: boolean = true;
	export let platform: string | null = null;
	export let eurostyle: boolean = false;

	$: shared_rt_time = event.last_stop ? event.realtime_arrival : event.realtime_departure;
	$: shared_scheduled_time = event.last_stop ? event.scheduled_arrival : event.scheduled_departure;

	$: routeDef = data_from_server.routes?.[event.chateau]?.[event.route_id];
	$: agencyId = routeDef?.agency_id;
	$: agencyName = data_from_server.agencies?.[event.chateau]?.[agencyId]?.agency_name;

	// Complex condition for showing route name from StopScreen logic
	// event.chateau !== 'nationalrailuk' || ['TW', 'ME', 'LO', 'XR', 'HX'].includes(agency_id_local)
	$: show_route_name =
		event.chateau !== 'nationalrailuk' || ['TW', 'ME', 'LO', 'XR', 'HX'].includes(agencyId);
</script>

<tr
	class="border-b border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
	on:click={() => {
		data_stack_store.update((x) => {
			x.push(
				new StackInterface(
					new SingleTrip(
						event.chateau,
						event.trip_id,
						event.route_id,
						null,
						event.service_date.replace(/-/g, ''),
						null,
						null
					)
				)
			);
			return x;
		});
	}}
>
	<!-- Leftmost: Route Name -->
	{#if eurostyle}
		<td class="px-1 py-0.5 w-[40px] align-middle text-left">
		{#if show_route_name && routeDef?.short_name}
			<span
				class="rounded-xs font-bold px-1 py-0.5 text-xs inline-block min-w-[24px]"
				style={`background: ${routeDef?.color}; color: ${routeDef?.text_color};`}
			>
				{routeDef?.short_name.replace(' Line', '')}
			</span>
		{/if}
	</td>
	{/if}

	<!-- Left: Time (Vertical Stack) -->
	<td class="px-1 py-0.5 w-[70px] align-middle">
		<div class="flex flex-col items-start justify-center text-xs">
			{#if event.trip_cancelled}
				<span class="text-red-500 font-semibold text-xs">{$_('cancelled')}</span>
				<div class="line-through opacity-70 text-xs">
					<Clock {timezone} time_seconds={shared_scheduled_time} {show_seconds} />
				</div>
			{:else if event.trip_deleted}
				<span class="text-red-500 font-semibold text-xs">{$_('deleted')}</span>
				<div class="line-through opacity-70 text-xs">
					<Clock {timezone} time_seconds={shared_scheduled_time} {show_seconds} />
				</div>
			{:else if event.stop_cancelled}
				<span class="text-red-500 font-semibold text-xs">{$_('stop_cancelled')}</span>
				<div class="line-through opacity-70 text-xs">
					<Clock {timezone} time_seconds={shared_scheduled_time} {show_seconds} />
				</div>
			{:else}
				{#if shared_rt_time}
					<!-- Vertical Mode: Scheduled -> Delay -> Realtime -->
					{#if shared_rt_time != shared_scheduled_time}
						<span class="text-gray-600 dark:text-gray-400 line-through text-xs">
							<Clock {timezone} time_seconds={shared_scheduled_time} {show_seconds} />
						</span>
						{#if shared_scheduled_time}
							<DelayDiff
								diff={shared_rt_time - shared_scheduled_time}
								{show_seconds}
								{use_symbol_sign}
							/>
						{/if}
						<span
							class={`text-seashore dark:text-seashoredark font-medium ${shared_rt_time < current_time / 1000 ? 'opacity-70' : ''}`}
						>
							<Clock {timezone} time_seconds={shared_rt_time} {show_seconds} />
						</span>
					{:else}
						<!-- On Time (Vertical) - Just show Clock -->
						<span
							class={`text-seashore dark:text-seashoredark font-medium ${shared_rt_time < current_time / 1000 ? 'opacity-70' : ''}`}
						>
							<Clock {timezone} time_seconds={shared_rt_time} {show_seconds} />
						</span>
					{/if}
				{:else}
					<div class={`${shared_scheduled_time < current_time / 1000 ? 'opacity-70' : ''}`}>
						<Clock {timezone} time_seconds={shared_scheduled_time} {show_seconds} />
					</div>
				{/if}

				{@const thisdiff = (shared_rt_time || shared_scheduled_time) - current_time / 1000}
				{@const show_seconds_here = show_seconds && thisdiff < 3600}
				{#if show_timediff}
					<div class="mt-0.5">
						<TimeDiff
							large={false}
							show_brackets={false}
							show_seconds={show_seconds_here}
							diff={thisdiff}
							use_ticks={true}
						/>
					</div>
				{/if}
			{/if}
		</div>
	</td>

	<!-- Middle: Info -->
	<td class="px-1 py-0.5 align-middle">
		<div class="flex flex-col justify-center">
			<div class="flex flex-row items-center gap-2 mb-0.5">
				<div class="text-sm font-normal leading-none">
					{event.headsign}
					{#if event.trip_short_name}
						<span class="font-bold ml-1 text-xs">{event.trip_short_name}</span>
					{/if}
				</div>
			</div>
			<div
				class="flex flex-row text-xs text-gray-600 dark:text-gray-400 gap-2 items-center flex-wrap"
			>
			{#if show_route_name && !(eurostyle && routeDef?.short_name)}
					<span
						class="rounded-xs font-bold px-1 py-0.5 text-xs"
						style={`background: ${routeDef?.color}; color: ${routeDef?.text_color};`}
					>
						{#if routeDef?.short_name}
							{routeDef?.short_name} <!-- .replace(' Line', '') -- we don't remove "Line" for consistency with StationScreenTrainRow -->
						{:else}
							{routeDef?.long_name}
						{/if}
					</span>
				{/if}
				{#if agencyName && show_agency_name}
					{#if agencyId === 'GWR' || agencyName?.trim().toLowerCase() === 'gwr'}
						<img
							src="/agencyicons/GreaterWesternRailway.svg"
							alt={agencyName}
							class="h-4 inline-block dark:hidden"
						/>
						<img
							src="/agencyicons/GreaterWesternRailwayBrighter.svg"
							alt={agencyName}
							class="h-4 hidden dark:inline-block"
						/>
						<span class="ml-1">Great Western Railway</span>
					{:else if agencyName?.trim().toLowerCase() === 'london overground'}
						<img
							src="/agencyicons/uk-london-overground.svg"
							alt={agencyName}
							class="h-4 inline-block"
						/>
					{:else if agencyId === 'CC' || agencyName?.trim().toLowerCase() === 'c2c'}
						<img src="/agencyicons/c2c_logo.svg" alt={agencyName} class="h-4 inline-block" />
						<span class="ml-1">c2c</span>
					{:else if agencyName?.trim().toLowerCase() === 'elizabeth line'}
						<img
							src="/agencyicons/Elizabeth_line_roundel.png"
							alt={agencyName}
							class="h-4 inline-block"
						/>
					{:else}
						<span>{agencyName}</span>
					{/if}
				{/if}
			</div>
		</div>
	</td>

	<!-- Right: Platform -->
	<td class="px-1 py-0.5 text-right w-[80px] align-middle">
		{#if platform}
			<span
				class="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs font-bold text-gray-800 dark:text-gray-200 inline-block"
			>
				{platform.replace('Track', '').replace('platform', '').replace('Platform', '').trim()}
			</span>
		{/if}
	</td>
</tr>
