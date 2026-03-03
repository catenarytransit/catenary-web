<script lang="ts">
	import HomeButton from './SidebarParts/home_button.svelte';
	import { _ } from 'svelte-i18n';
	import { onMount } from 'svelte';
	import Clock from './Clock.svelte';
	import TimeDiff from './TimeDiff.svelte';
	import { data_stack_store, ui_theme_store } from '../globalstores';
	import { StackInterface, SingleTrip } from './stackenum';
	import { determineDarkModeToBool } from './determineDarkModeToBool';

	export let chateau: string;
	export let block_id: string;
	export let service_date: string;

	let trip_duration_seconds = 0;

	let block_data: any = {};
	let loading_done = false;

	let single_route = false;

	let darkMode = determineDarkModeToBool();
	$: if ($ui_theme_store) {
		if (typeof window !== 'undefined') {
			darkMode = determineDarkModeToBool();
		}
	}

	let current_time = Math.floor(Date.now() / 1000);

	let interval_timer = setInterval(() => {
		current_time = Math.floor(Date.now() / 1000);
	}, 1000);

	function getData() {
		fetch(
			`https://birch.catenarymaps.org/get_block?chateau=${chateau}&block_id=${block_id}&service_date=${service_date}`
		)
			.then((response) => response.text())
			.then((text) => {
				let data = JSON.parse(text);

				if (data.routes) {
					single_route = Object.keys(data.routes).length == 1;
				}

				console.log(data);

				if (data) {
					block_data = data;

					let first_trip = block_data.trips[0];
					let last_trip = block_data.trips[block_data.trips.length - 1];

					trip_duration_seconds = last_trip.end_time - first_trip.start_time;
				} else {
					block_data = null;
				}
				loading_done = true;
			});
	}

	$: if (block_id) {
		getData();
	}

	$: if (service_date) {
		getData();
	}

	onMount(() => {
		getData();

		() => {
			clearInterval(interval_timer);
		};
	});
</script>

<HomeButton />

<div class="px-3 catenary-scroll overflow-y-auto grow">
	{#if single_route}
		<p>
			{#if block_data.routes[Object.keys(block_data.routes)[0]].short_name}
				<span
					class="font-semibold"
					style="color:{block_data.routes[Object.keys(block_data.routes)[0]].color}"
				>
					{block_data.routes[Object.keys(block_data.routes)[0]].short_name}</span
				>
			{/if}

			{#if block_data.routes[Object.keys(block_data.routes)[0]].long_name}
				<span style="color:{block_data.routes[Object.keys(block_data.routes)[0]].color}">
					{block_data.routes[Object.keys(block_data.routes)[0]].long_name}</span
				>
			{/if}
		</p>
	{/if}

	<p class="font-semibold">{$_('block')}: {block_id}</p>

	{$_('Duration')}: <TimeDiff show_brackets={false} diff={trip_duration_seconds} />

	{#if block_data}
		<div class="w-full flex flex-col mt-2">
			{#each block_data.trips as trip, index}
				<div
					class={`flex flex-row w-full mb-1 ${current_time > trip.end_time ? 'opacity-60' : ''}`}
				>
					<!-- Left: Times -->
					<div class="w-[4.5rem] flex flex-col justify-between items-end shrink-0 py-3 relative">
						<div class="font-bold leading-none text-sm text-right mt-1">
							<Clock timezone={trip.timezone_start} time_seconds={trip.start_time} />
						</div>
						<div class="font-bold leading-none text-sm text-right mb-1">
							<Clock timezone={trip.timezone_end} time_seconds={trip.end_time} />
						</div>
					</div>

					<!-- Middle: Pearl Chain -->
					<div class="w-4 shrink-0 relative flex flex-col items-center ml-2 mr-3">
						<div
							class="bg-gray-800 dark:bg-gray-300 w-0.5 absolute top-4 bottom-4 left-1/2 -translate-x-1/2 bg-current"
						></div>

						{#if current_time >= trip.start_time && current_time <= trip.end_time}
							<div
								class="absolute z-50 w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse"
								style="top: calc({Math.max(
									0,
									Math.min(1, (current_time - trip.start_time) / (trip.end_time - trip.start_time))
								) * 100}%); left: 50%; transform: translateX(-50%) translateY(-50%);"
							></div>
						{/if}

						<!-- Start dot -->
						<div
							class="bg-gray-800 dark:bg-gray-300 z-10 w-2 h-2 rounded-full border-1 bg-white dark:bg-gray-800 absolute top-4 transform -translate-y-1/2"
							style="box-shadow: 0 0 0 2px {darkMode ? '#114' : '#fff'};"
						></div>

						<!-- End dot -->
						<div
							class="bg-gray-800 dark:bg-gray-300 z-10 w-2 h-2 rounded-full border-1 bg-white dark:bg-gray-800 absolute bottom-4 transform translate-y-1/2"
							style="box-shadow: 0 0 0 2px {darkMode ? '#114' : '#fff'};"
						></div>
					</div>

					<!-- Right: Content -->
					<div
						class="grow shrink min-w-0 bg-gray-100 dark:bg-slate-800 dark:bg-opacity-50 p-3 rounded-lg flex flex-col gap-2"
					>
						<p class="font-bold leading-none mt-1">{trip.first_stop_name}</p>

						<!-- Route Info Inner Box -->
						<div
							class="my-1 text-sm bg-slate-200 dark:bg-slate-900 dark:bg-opacity-40 p-2 rounded-lg flex flex-col gap-1 ml-[0.2rem]"
						>
							{#if block_data.routes[trip.route_id] && !single_route}
								<p class="align-center mb-0.5 leading-none">
									{#if block_data.routes[trip.route_id].short_name}
										<span
											class="font-semibold"
											style="color:{block_data.routes[trip.route_id].color}"
										>
											{block_data.routes[trip.route_id].short_name}
										</span>
									{/if}
									{#if block_data.routes[trip.route_id].long_name}
										<span style="color:{block_data.routes[trip.route_id].color}" class="ml-1">
											{block_data.routes[trip.route_id].long_name}
										</span>
									{/if}
								</p>
							{/if}

							<div class="flex flex-row">
								<div>
									<p class="my-auto align-center leading-none">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 -960 960 960"
											class="h-4 w-4 inline-block opacity-75 mr-0.5"
											fill="currentColor"
											><path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z" /></svg
										>
										{trip.trip_headsign}
									</p>
								</div>
								<div class="ml-auto">
									<div
										on:click={() => {
											data_stack_store.update((x) => {
												x.push(
													new StackInterface(
														new SingleTrip(
															chateau,
															trip.trip_id,
															trip.route_id,
															null,
															service_date.replaceAll('-', ''),
															null,
															null
														)
													)
												);
												return x;
											});
										}}
										class="px-1 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer hover:bg-blue-100 dark:hover:bg-slate-700 leading-none mt-[-0.2rem]"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 -960 960 960"
											class="h-4 inline-block"
											fill="currentColor"
											><path
												d="M120-120v-320h80v184l504-504H520v-80h320v320h-80v-184L256-200h184v80H120Z"
											/></svg
										>
									</div>
								</div>
							</div>
						</div>

						<div class="text-sm opacity-75 leading-none mb-1">
							{$_('Duration')}: <TimeDiff
								show_brackets={false}
								diff={trip.end_time - trip.start_time}
							/>
						</div>

						<p class="font-bold leading-none mb-1">{trip.last_stop_name}</p>
					</div>
				</div>

				<!-- Layover -->
				{#if block_data.trips[index + 1]}
					<div
						class={`flex flex-row w-full mb-1 ${current_time > trip.end_time ? 'opacity-60' : ''}`}
					>
						<div class="w-[4.5rem] shrink-0"></div>
						<div class="w-4 shrink-0 relative flex flex-col items-center ml-2 mr-3">
							<div
								class="bg-gray-400 dark:bg-gray-500 w-[1px] absolute top-[-0.25rem] bottom-[-0.25rem] left-1/2 -translate-x-1/2 opacity-70 border-l border-dashed border-gray-400 dark:border-gray-500"
							></div>
						</div>
						<div
							class="grow shrink min-w-0 flex items-center gap-1 text-gray-400 dark:text-gray-400 text-sm py-1"
						>
							<span class="material-symbols-outlined align-center text-[1rem]"
								>self_improvement</span
							>
							<p class="mt-[1px] leading-none">
								<TimeDiff
									show_brackets={false}
									diff={block_data.trips[index + 1].start_time - trip.end_time}
								/>
							</p>
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>
