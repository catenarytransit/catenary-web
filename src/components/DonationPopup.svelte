<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';

	export let title: string;
	export let message: string;
	export let compact = false;
	export let dismissible = true;

	const dispatch = createEventDispatcher<{ dismiss: void }>();
	const predefinedAmounts = [4, 10, 15, 25];
	const currencyByCountry: Record<string, string> = {
		GB: 'GBP',
		CA: 'CAD',
		AU: 'AUD',
		IE: 'EUR',
		NZ: 'NZD',
		ZA: 'ZAR'
	};

	let language = 'en-US';
	let currency = 'USD';
	let conversionRate = 1;

	onMount(() => {
		language = navigator.language || 'en-US';
		if (!compact) void loadCurrency();
	});

	async function loadCurrency() {
		const localeParts = language.split('-');
		const country =
			localeParts.length > 1 ? localeParts[localeParts.length - 1].toUpperCase() : 'US';
		currency = currencyByCountry[country] || 'USD';

		try {
			const response = await fetch('https://open.er-api.com/v6/latest/USD');
			if (!response.ok) return;

			const data = await response.json();
			if (data?.rates?.[currency]) conversionRate = data.rates[currency];
		} catch (error) {
			console.error('Failed to fetch exchange rates', error);
		}
	}

	function formatMoney(amount: number) {
		try {
			return new Intl.NumberFormat(language, {
				style: 'currency',
				currency,
				minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
				maximumFractionDigits: 2
			}).format(amount);
		} catch {
			return `$${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
		}
	}

	function getDonationLink(amount: number | null) {
		if (amount == null) {
			return 'https://opencollective.com/catenarymaps/donate?platformTip=0';
		}

		const params = new URLSearchParams({
			amount: (amount / conversionRate).toFixed(2),
			platformTip: '0'
		});
		return `https://opencollective.com/catenarymaps/donate?${params.toString()}`;
	}
</script>

<div
	class="relative rounded-xl border border-sky-300 bg-sky-50 shadow-md dark:border-sky-700 dark:bg-gray-800 {compact
		? 'p-3'
		: 'p-4'}"
	role="complementary"
	aria-label={title}
>
	{#if dismissible}
		<button
			type="button"
			class="absolute top-2 right-2 rounded-full p-1 text-sky-900 transition-colors hover:bg-sky-200 hover:text-sky-700 dark:text-sky-100 dark:hover:bg-gray-600 dark:hover:text-white"
			on:click={() => dispatch('dismiss')}
			aria-label="Dismiss fundraising message"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				height={compact ? 18 : 20}
				viewBox="0 -960 960 960"
				width={compact ? 18 : 20}
				fill="currentColor"
			>
				<path
					d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"
				/>
			</svg>
		</button>
	{/if}

	<h2
		class="font-bold leading-tight text-sky-900 dark:text-sky-100 {compact
			? 'text-sm'
			: 'text-lg'} {dismissible ? 'pr-8' : ''}"
	>
		{title}
	</h2>
	<p
		class="text-sky-800 dark:text-gray-300 {compact
			? 'mt-0.5 text-[11px] leading-tight'
			: 'mt-2 text-sm leading-snug'} {compact && dismissible ? 'pr-7' : ''}"
	>
		{message}
	</p>

	<!--
		Amount counter and progress bar are intentionally disabled.

		<div class="mt-1 h-3 w-full overflow-hidden rounded-full bg-sky-200 dark:bg-gray-700">
			<div class="h-3 rounded-full bg-sky-600 dark:bg-sky-500"></div>
		</div>
		<div class="mb-1 flex justify-between text-xs font-semibold text-sky-700 dark:text-sky-300">
			<span>Amount raised</span>
			<span>Goal</span>
		</div>
	-->

	{#if compact}
		<a
			href={getDonationLink(null)}
			target="_blank"
			rel="noopener noreferrer"
			class="mt-2 inline-flex rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
		>
			Donate
		</a>
	{:else}
		<div class="mt-3 flex flex-wrap justify-center gap-2">
			{#each predefinedAmounts as amount}
				<a
					href={getDonationLink(amount)}
					target="_blank"
					rel="noopener noreferrer"
					class="min-w-[4.5rem] flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-center text-sm font-medium text-white hover:bg-blue-700"
				>
					{formatMoney(amount)}
				</a>
			{/each}
			<a
				href={getDonationLink(null)}
				target="_blank"
				rel="noopener noreferrer"
				class="min-w-[4.5rem] flex-1 rounded-lg bg-gray-300 px-3 py-1.5 text-center text-sm font-medium text-gray-800 hover:bg-gray-400 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500"
			>
				Custom
			</a>
		</div>
	{/if}
</div>
