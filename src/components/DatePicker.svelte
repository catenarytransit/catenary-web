<script lang="ts">
	import { locale, _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import { createEventDispatcher } from 'svelte';

	export let unixTime: number = Date.now() / 1000;
	export let isNow: boolean = true;
	export let timezone: string = 'UTC';

	const dispatch = createEventDispatcher();

	// We use an internal string YYYY-MM-DD for the native input
	let dateString = '';
	let timeString = '';

	function getTzParts(unixTimeSec: number, tz: string) {
		const d = new Date(unixTimeSec * 1000);
		const options = {
			timeZone: tz === 'Local Time' || !tz ? undefined : tz,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		} as const;
		const formatter = new Intl.DateTimeFormat('en-CA', options);
		const parts = formatter.formatToParts(d);

		let year = '', month = '', day = '', hour = '', minute = '';
		for (const part of parts) {
			if (part.type === 'year') year = part.value;
			if (part.type === 'month') month = part.value;
			if (part.type === 'day') day = part.value;
			if (part.type === 'hour') hour = part.value;
			if (part.type === 'minute') minute = part.value;
		}
		return { year, month, day, hour, minute };
	}

	function getUnixTimeInTz(
		year: number,
		month: number,
		day: number,
		hour: number,
		minute: number,
		tz: string
	): number {
		const utcTimestamp = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
		const options = {
			timeZone: tz === 'Local Time' || !tz ? undefined : tz,
			year: 'numeric',
			month: 'numeric',
			day: 'numeric',
			hour: 'numeric',
			minute: 'numeric',
			second: 'numeric',
			hour12: false
		} as const;

		const formatter = new Intl.DateTimeFormat('en-US', options);
		const tempDate = new Date(utcTimestamp);
		const formattedStr = formatter.format(tempDate);
		const match = formattedStr.match(/(\d+)\/(\d+)\/(\d+),\s+(\d+):(\d+):(\d+)/);
		if (!match) {
			return utcTimestamp / 1000;
		}

		const [_, mStr, dStr, yStr, hStr, minStr, sStr] = match;
		const parsedY = parseInt(yStr, 10);
		const parsedM = parseInt(mStr, 10);
		const parsedD = parseInt(dStr, 10);
		const parsedH = parseInt(hStr, 10);
		const parsedMin = parseInt(minStr, 10);
		const parsedSec = parseInt(sStr, 10);

		const formattedUtc = Date.UTC(parsedY, parsedM - 1, parsedD, parsedH, parsedMin, parsedSec, 0);
		const offsetMs = formattedUtc - utcTimestamp;

		return (utcTimestamp - offsetMs) / 1000;
	}

	$: {
		const currentUnix = isNow ? Date.now() / 1000 : unixTime;
		const parts = getTzParts(currentUnix, timezone);
		dateString = `${parts.year}-${parts.month}-${parts.day}`;
		timeString = `${parts.hour}:${parts.minute}`;
	}

	function handleDateChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.value) {
			isNow = false;
			dateString = target.value;
			const [y, m, d] = target.value.split('-').map(Number);

			let h = 0;
			let min = 0;
			if (timeString && timeString.includes(':')) {
				const parts = timeString.split(':').map(Number);
				if (!isNaN(parts[0]) && !isNaN(parts[1])) {
					h = parts[0];
					min = parts[1];
				}
			}

			unixTime = getUnixTimeInTz(y, m, d, h, min, timezone);
			dispatch('change');
		}
	}

	function applyTimeInput(val: string) {
		val = val.trim().toLowerCase();
		if (!val) return;

		let isPM = val.includes('p') || val.includes('pm') || val.endsWith('p');
		let isAM = val.includes('a') || val.includes('am') || val.endsWith('a');
		val = val.replace(/[apm\s]/g, '');

		let hours = 0,
			minutes = 0;
		if (val.includes(':')) {
			const parts = val.split(':');
			hours = parseInt(parts[0], 10);
			minutes = parseInt(parts[1], 10);
		} else if (val.length <= 2) {
			hours = parseInt(val, 10);
			minutes = 0;
		} else if (val.length === 3) {
			hours = parseInt(val.slice(0, 1), 10);
			minutes = parseInt(val.slice(1), 10);
		} else if (val.length === 4) {
			hours = parseInt(val.slice(0, 2), 10);
			minutes = parseInt(val.slice(2), 10);
		} else {
			return;
		}

		if (isNaN(hours) || isNaN(minutes)) return;

		if (isPM && hours < 12) hours += 12;
		if (isAM && hours === 12) hours = 0;

		hours = Math.max(0, Math.min(23, hours));
		minutes = Math.max(0, Math.min(59, minutes));

		isNow = false;

		const [y, m, d] = dateString.split('-').map(Number);
		unixTime = getUnixTimeInTz(y, m, d, hours, minutes, timezone);
		dispatch('change');
	}

	function handleTimeBlur(e: Event) {
		const target = e.target as HTMLInputElement;
		applyTimeInput(target.value);
	}

	function handleTimeKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			const target = e.target as HTMLInputElement;
			applyTimeInput(target.value);
			target.blur();
		}
	}

	function advanceTime(minutesToChange: number) {
		isNow = false;
		let currentH = 0;
		let currentM = 0;
		if (timeString && timeString.includes(':')) {
			const parts = timeString.split(':');
			currentH = parseInt(parts[0], 10) || 0;
			currentM = parseInt(parts[1], 10) || 0;
		}

		let newM = currentM;
		if (minutesToChange > 0) {
			newM = Math.floor(currentM / 15) * 15 + 15;
		} else if (minutesToChange < 0) {
			if (currentM % 15 === 0) {
				newM = currentM - 15;
			} else {
				newM = Math.floor(currentM / 15) * 15;
			}
		}

		let [y, m, d] = dateString
			? dateString.split('-').map(Number)
			: (() => {
					const parts = getTzParts(Date.now() / 1000, timezone);
					return [parseInt(parts.year, 10), parseInt(parts.month, 10), parseInt(parts.day, 10)];
				})();

		const date = new Date(Date.UTC(y, m - 1, d, currentH, newM));
		const finalY = date.getUTCFullYear();
		const finalM = date.getUTCMonth() + 1;
		const finalD = date.getUTCDate();
		const finalH = date.getUTCHours();
		const finalMin = date.getUTCMinutes();

		unixTime = getUnixTimeInTz(finalY, finalM, finalD, finalH, finalMin, timezone);
		dispatch('change');
	}

	function handleNowClick() {
		isNow = true;
		unixTime = Date.now() / 1000;
		dispatch('change');
	}

	$: displayDate = (() => {
		if (!dateString) return '';
		const [y, m, d] = dateString.split('-');

		let loc = get(locale) || 'en';
		loc = loc.toLowerCase();

		if (loc.startsWith('zh') || loc.startsWith('ko') || loc.startsWith('ja')) {
			return `${y}-${m}-${d}`;
		}

		const canadianZones = [
			'America/Toronto',
			'America/Vancouver',
			'America/Edmonton',
			'America/Winnipeg',
			'America/Halifax',
			'America/St_Johns',
			'America/Regina',
			'America/Moncton',
			'America/Blanc-Sablon',
			'America/Creston',
			'America/Dawson',
			'America/Dawson_Creek',
			'America/Fort_Nelson',
			'America/Glace_Bay',
			'America/Goose_Bay',
			'America/Inuvik',
			'America/Iqaluit',
			'America/Nipigon',
			'America/Pangnirtung',
			'America/Rainy_River',
			'America/Rankin_Inlet',
			'America/Resolute',
			'America/Swift_Current',
			'America/Thunder_Bay',
			'America/Whitehorse',
			'America/Yellowknife'
		];
		if (timezone && canadianZones.includes(timezone)) {
			return `${y}-${m}-${d}`;
		}

		if (timezone && timezone.startsWith('Europe/')) {
			return `${d}.${m}.${y}`;
		}

		return `${y}-${m}-${d}`;
	})();

	let isCalendarOpen = false;
	let calendarYear = new Date().getFullYear();
	let calendarMonth = new Date().getMonth();

	function openCalendar() {
		isCalendarOpen = !isCalendarOpen;
		if (isCalendarOpen && dateString) {
			const [y, m, d] = dateString.split('-').map(Number);
			calendarYear = y;
			calendarMonth = m - 1;
		} else if (isCalendarOpen) {
			const d = new Date();
			calendarYear = d.getFullYear();
			calendarMonth = d.getMonth();
		}
	}

	function changeMonth(delta: number) {
		calendarMonth += delta;
		if (calendarMonth < 0) {
			calendarMonth = 11;
			calendarYear--;
		} else if (calendarMonth > 11) {
			calendarMonth = 0;
			calendarYear++;
		}
	}

	function selectDate(year: number, month: number, day: number) {
		isNow = false;

		let h = 0;
		let min = 0;
		if (timeString && timeString.includes(':')) {
			const parts = timeString.split(':').map(Number);
			if (!isNaN(parts[0]) && !isNaN(parts[1])) {
				h = parts[0];
				min = parts[1];
			}
		}

		unixTime = getUnixTimeInTz(year, month + 1, day, h, min, timezone);
		isCalendarOpen = false;
		dispatch('change');
	}

	$: weekDays = (() => {
		const loc = $locale || 'en';
		return [1, 2, 3, 4, 5, 6, 0].map((day) => {
			const date = new Date(2024, 0, day === 0 ? 7 : day); // 2024-01-01 is Monday
			try {
				return new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(date);
			} catch (e) {
				return new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date);
			}
		});
	})();

	$: calendarGrid = (() => {
		const firstDay = new Date(calendarYear, calendarMonth, 1);
		const lastDay = new Date(calendarYear, calendarMonth + 1, 0);

		let startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
		const daysInMonth = lastDay.getDate();

		const grid = [];
		let currentWeek = [];

		for (let i = 0; i < startingDayOfWeek; i++) {
			currentWeek.push(null);
		}

		for (let day = 1; day <= daysInMonth; day++) {
			currentWeek.push(day);
			if (currentWeek.length === 7) {
				grid.push(currentWeek);
				currentWeek = [];
			}
		}

		if (currentWeek.length > 0) {
			while (currentWeek.length < 7) {
				currentWeek.push(null);
			}
			grid.push(currentWeek);
		}

		return grid;
	})();

	$: currentTzDate = (() => {
		const parts = getTzParts(Date.now() / 1000, timezone);
		return {
			year: parseInt(parts.year, 10),
			month: parseInt(parts.month, 10) - 1,
			day: parseInt(parts.day, 10)
		};
	})();

	$: calendarMonthName = (() => {
		const loc = $locale || 'en';
		const d = new Date(calendarYear, calendarMonth, 1);
		try {
			return new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(d);
		} catch (e) {
			return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(d);
		}
	})();
</script>

<div class="flex flex-col mb-2">
	<div class="flex flex-row gap-2 items-center">
		<!-- Date Box -->
		<div
			class="relative flex items-center border border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-800 text-black dark:text-white px-2 py-1 rounded-[1px] focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500"
		>
			<span class={`font-medium text-sm min-w-[5rem] text-center px-1`}>{displayDate}</span>
			<span class="material-symbols-outlined ml-2 text-gray-500 text-base pointer-events-none"
				>calendar_today</span
			>

			<!-- Mobile Native Picker -->
			<input
				type="date"
				class="absolute inset-0 w-full h-full opacity-0 cursor-pointer md:hidden"
				value={dateString}
				on:change={handleDateChange}
			/>

			<!-- Desktop Custom Picker Trigger -->
			<button
				class="absolute inset-0 w-full h-full hidden md:block cursor-pointer bg-transparent border-0"
				on:click={openCalendar}
				aria-label="Open Calendar"
			></button>

			<!-- Desktop Custom Picker Popup -->
			{#if isCalendarOpen}
				<!-- Backdrop -->
				<button
					class="fixed inset-0 z-40 hidden md:block cursor-default w-full h-full bg-transparent border-0 outline-none"
					tabindex="-1"
					on:click|stopPropagation={() => (isCalendarOpen = false)}
				></button>

				<div
					class="absolute top-[110%] left-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-xl rounded z-50 p-4 hidden md:block min-w-[280px]"
				>
					<!-- Header -->
					<div class="flex justify-between items-center mb-4">
						<button
							class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
							on:click|stopPropagation={() => changeMonth(-1)}
						>
							<span class="material-symbols-outlined text-sm pointer-events-none">chevron_left</span
							>
						</button>
						<span class="font-semibold text-gray-800 dark:text-gray-100">{calendarMonthName}</span>
						<button
							class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
							on:click|stopPropagation={() => changeMonth(1)}
						>
							<span class="material-symbols-outlined text-sm pointer-events-none"
								>chevron_right</span
							>
						</button>
					</div>
					<!-- Calendar Grid -->
					<table class="w-full border-collapse">
						<thead>
							<tr>
								{#each weekDays as dayName}
									<th class="text-xs font-semibold text-gray-500 dark:text-gray-400 p-1 w-8"
										>{dayName}</th
									>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each calendarGrid as week}
								<tr>
									{#each week as day}
										<td class="p-1">
											{#if day}
												{@const isSelected =
													dateString &&
													parseInt(dateString.split('-')[0]) === calendarYear &&
													parseInt(dateString.split('-')[1]) === calendarMonth + 1 &&
													parseInt(dateString.split('-')[2]) === day}
												{@const isTodayInTz =
													currentTzDate.year === calendarYear &&
													currentTzDate.month === calendarMonth &&
													currentTzDate.day === day}
												<button
													class="w-8 h-8 flex items-center justify-center rounded-full transition-colors mx-auto text-sm outline-none
													{isSelected
														? 'bg-blue-600 text-white dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500'
														: 'bg-transparent hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200'}
													{isTodayInTz ? 'font-bold underline' : ''}"
													on:click|stopPropagation={() =>
														selectDate(calendarYear, calendarMonth, day)}
												>
													{day}
												</button>
											{/if}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<!-- Time Box -->
		<div
			class="flex items-center border border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-800 rounded-[1px] focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500"
		>
			<button
				class="select-none px-1 py-1 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors dark:text-gray-300"
				on:click={() => advanceTime(-15)}
			>
				<span class="material-symbols-outlined text-[1rem]">chevron_left</span>
			</button>
			<input
				type="text"
				class="bg-transparent text-black dark:text-white focus:outline-none w-12 text-center text-sm font-medium placeholder-gray-400"
				maxlength="8"
				placeholder="00:00"
				value={timeString}
				on:blur={handleTimeBlur}
				on:keydown={handleTimeKeydown}
			/>
			<button
				class="select-none px-1 py-1 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors dark:text-gray-300"
				on:click={() => advanceTime(15)}
			>
				<span class="material-symbols-outlined text-[1rem]">chevron_right</span>
			</button>
		</div>

		<!-- Now Button -->
		<button
			class={`border px-3 py-1 font-bold text-sm rounded-[1px] transition-colors ${
				isNow
					? 'border-blue-500 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200'
					: 'border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-800 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
			}`}
			on:click={handleNowClick}
		>
			{$_('now') || 'Now'}
		</button>
	</div>
	{#if timezone && timezone !== 'Local Time'}
		<div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
			{timezone}
		</div>
	{/if}
</div>
