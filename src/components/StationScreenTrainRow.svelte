<script lang="ts">
	import TimeDiff from './TimeDiff.svelte';

	import BullseyeArrow from './svg_icons/bullseye_arrow.svelte';
	import DelayDiff from './DelayDiff.svelte';
	import { _ } from 'svelte-i18n';
	import Clock from './Clock.svelte';
	import { SingleTrip, StackInterface } from './stackenum';
	import { data_stack_store } from '../globalstores';
	import StationScreenRouteBadge from './StationScreenRouteBadge.svelte';
	import db_train_lookup from '../../static/fernverkehr_2026_train_lookup.json';
	import { RouteTypes, type Route } from '../utils/models';

	export let event: any;
	export let data_from_server: any;
	export let current_time: number;
	export let show_seconds: boolean;
	export let use_symbol_sign: boolean = false;
	export let timezone: string = 'UTC';
	export let show_timediff: boolean = true;
	export let show_agency_name: boolean = true;
	export let eurostyle: boolean = false;
	export let swiss_style: boolean = false;
	export let eventAlerts: any[] = [];

	$: shared_rt_time = event.last_stop ? event.realtime_arrival : event.realtime_departure;
	$: shared_scheduled_time = event.last_stop ? event.scheduled_arrival : event.scheduled_departure;

	$: routeDef = data_from_server.routes?.[event.chateau]?.[event.route_id] as Route;
	$: agencyId = routeDef?.agency_id;
	$: agencyName = data_from_server.agencies?.[event.chateau]?.[agencyId]?.agency_name;

	// Complex condition for showing route name from StopScreen logic
	// event.chateau !== 'nationalrailuk' || ['TW', 'ME', 'LO', 'XR', 'HX'].includes(agency_id_local)
	$: show_route_name =
		event.chateau !== 'nationalrailuk' || ['TW', 'ME', 'LO', 'XR', 'HX'].includes(agencyId);

	$: is_db_fernverkehr =
		event.chateau === 'deutschland' &&
		agencyId &&
		['12681', '13557', '10918'].includes(agencyId.toString());
	$: trip_short_name_no_zeros = event.trip_short_name
		? event.trip_short_name.replace(/^0+/, '')
		: null;
	$: db_train_data =
		is_db_fernverkehr && trip_short_name_no_zeros
			? (db_train_lookup as Record<string, any[]>)[trip_short_name_no_zeros]
			: null;
	$: db_display_name = db_train_data ? db_train_data[0].display_name : event.trip_short_name;

	$: is_rail = routeDef?.route_type == RouteTypes.RAIL;
	$: eurostyle_rail = eurostyle && is_rail;
	$: swiss_style_rail = swiss_style && is_rail;
	$: eurostyle_or_swiss_style_rail = eurostyle_rail || swiss_style_rail;
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
	{#if swiss_style_rail}
		<td class="px-1 py-0.5 w-[40px] align-middle text-left">
			<StationScreenRouteBadge
				{routeDef}
				chateau={event.chateau}
				remove_line={true}
				extra_classes="inline-block min-w-[24px]"
				fallback_long_name={false}
				db_show_linie={false}
				{db_train_data}
			/>
		</td>
	{/if}

	<!-- Left: Time (Vertical Stack) -->
	<td class="px-2 py-2 w-[80px] align-middle">
		<div class="flex flex-col items-start justify-center">
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
			{:else if shared_rt_time}
				<!-- Vertical Mode: Scheduled -> Delay -> Realtime -->
				{#if shared_rt_time != shared_scheduled_time}
					<span class="text-gray-600 dark:text-gray-400 line-through">
						<Clock {timezone} time_seconds={shared_scheduled_time} {show_seconds} />
					</span>
					<span
						class={`text-seashore dark:text-seashoredark font-medium ${shared_rt_time < current_time / 1000 ? 'opacity-70' : ''}`}
					>
						<Clock {timezone} time_seconds={shared_rt_time} {show_seconds} />
					</span>
					{#if shared_scheduled_time}
						<DelayDiff
							diff={shared_rt_time - shared_scheduled_time}
							{show_seconds}
							{use_symbol_sign}
						/>
					{/if}
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
		</div>
	</td>

	<!-- Middle: Route Name for Eurostyle -->
	{#if eurostyle_rail && !swiss_style_rail}
		<td class="px-1 py-0.5 w-[40px] align-middle text-left">
			<StationScreenRouteBadge
				{routeDef}
				chateau={event.chateau}
				remove_line={true}
				extra_classes="inline-block min-w-[24px]"
				fallback_long_name={false}
				db_show_linie={false}
				{db_train_data}
			/>
		</td>
	{/if}

	<!-- Middle: Info -->
	<td class="px-2 py-2 align-top">
		<div class="flex flex-col justify-start">
			{#if agencyName && show_agency_name && !eurostyle_or_swiss_style_rail}
			<div
				class="flex flex-row text-sm text-gray-600 dark:text-gray-400 gap-2 mb-1 items-center flex-wrap"
			>
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
						<!-- Nothing, since we'll put it on the route badge -->
					{:else if agencyId === 'CC' || agencyName?.trim().toLowerCase() === 'c2c'}
						<img src="/agencyicons/c2c_logo.svg" alt={agencyName} class="h-4 inline-block" />
						<span class="ml-1">c2c</span>
					{:else if agencyId === 'SW'}
						<img src="/agencyicons/SouthWesternRailway.svg" alt="South Western Railway" class="h-4 inline-block" />
						<span class="ml-1">South Western Railway</span>
					{:else if agencyId === 'SN'}
						<img src="/agencyicons/SouthernIcon.svg" alt="Southern" class="h-4 inline-block" />
						<span class="ml-1">Southern</span>
					{:else if agencyId === 'TL'}
						<img src="/agencyicons/ThamesLink.svg" alt="Thameslink" class="h-4 inline-block" />
						<span class="ml-1">Thameslink</span>
					{:else if agencyName?.trim().toLowerCase() === 'elizabeth line'}
						<img
							src="/agencyicons/Elizabeth_line_roundel.png"
							alt={agencyName}
							class="h-4 inline-block"
						/>
					{:else}
						<span class="leading-none">{agencyName}</span>
					{/if}
			</div>
			{/if}
			
			{#if !eurostyle_or_swiss_style_rail}
				<div
					class="flex flex-row items-center gap-2 mb-1"
				>
					{#if agencyName?.trim().toLowerCase() === 'london overground'}
						<img
							src="/agencyicons/uk-london-overground.svg"
							alt={agencyName}
							class="h-4 inline-block"
						/>
					{/if}
					{#if show_route_name}
						{#if routeDef}
							<StationScreenRouteBadge 
								{routeDef}
								chateau={event.chateau}
								fallback_long_name={true}
								{db_train_data}
							/>
						{/if}	
					{/if}
					{#if event.trip_short_name}
						<span
							class="text-sm"
						>
							{is_db_fernverkehr ? db_display_name : event.trip_short_name}
						</span>
					{/if}			
				</div>
			{/if}

			<div class="flex flex-row items-center gap-2 mb-1">
				<div class="text-base font-medium font-bold leading-tight">
					{#if event.final_station_name}
						<span class="mr-1">{event.final_station_name}{' '}</span>
					{/if}
					{event.headsign}

					{#if eurostyle_or_swiss_style_rail}
						<span class="ml-1">
							{is_db_fernverkehr ? db_display_name : event.trip_short_name}
						</span>
					{/if}
					{#if eventAlerts.length > 0}
						<span class="inline-block align-middle ml-1">
							<img src="/icons/service_alert.svg" alt="" class="w-3.5 h-3.5" />
						</span>
					{/if}
				</div>
			</div>		
			
			{#if agencyName && show_agency_name && eurostyle_or_swiss_style_rail}
			<div
				class="flex flex-row text-sm text-gray-600 dark:text-gray-400 gap-2 mb-1 items-center flex-wrap"
			>
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
						<!-- Nothing, since we'll put it on the route badge -->
					{:else if agencyId === 'CC' || agencyName?.trim().toLowerCase() === 'c2c'}
						<img src="/agencyicons/c2c_logo.svg" alt={agencyName} class="h-4 inline-block" />
						<span class="ml-1">c2c</span>
					{:else if agencyId === 'SW'}
						<img src="/agencyicons/SouthWesternRailway.svg" alt="South Western Railway" class="h-4 inline-block" />
						<span class="ml-1">South Western Railway</span>
					{:else if agencyId === 'SN'}
						<img src="/agencyicons/SouthernIcon.svg" alt="Southern" class="h-4 inline-block" />
						<span class="ml-1">Southern</span>
					{:else if agencyId === 'TL'}
						<img src="/agencyicons/ThamesLink.svg" alt="Thameslink" class="h-4 inline-block" />
						<span class="ml-1">Thameslink</span>
					{:else if agencyName?.trim().toLowerCase() === 'elizabeth line'}
						<img
							src="/agencyicons/Elizabeth_line_roundel.png"
							alt={agencyName}
							class="h-4 inline-block"
						/>
					{:else}
						<span class="leading-none">{agencyName}</span>
					{/if}
			</div>
			{/if}
		</div>
	</td>

	<!-- Right: Platform -->
	<td class="px-2 py-2 text-right w-[50px] align-middle">
		{#if event.platform_string_realtime}
			<span class=" px-2 py-1 text-sm font-bold inline-block">
				{event.platform_string_realtime
					.replace('Track', '')
					.replace('platform', '')
					.replace('Platform', '')
					.trim()}
			</span>
		{/if}
	</td>
</tr>
