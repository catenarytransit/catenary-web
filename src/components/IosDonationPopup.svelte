<script lang="ts">
	import { onMount } from 'svelte';

	let showPopup = false;
	let currency = 'USD';
	let symbol = '$';
	let conversionRate = 1;

	let goalUSD = 1200;
	let currentUSD = 516.59;

	let goalLocal = goalUSD;
	let currentLocal = currentUSD;

	let predefinedAmounts = [4, 10, 20, 50];

	onMount(async () => {
		// Check if Safari or iPhone/iPad
		const ua = navigator.userAgent;
		const isIOS = /iPad|iPhone|iPod/.test(ua);
		const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/Chromium/.test(ua);

		const lang = navigator.language || '';
		const isEnglish = lang.toLowerCase().startsWith('en');
		const params = new URLSearchParams(window.location.search);

		const lastShown = localStorage.getItem('iosDonationLastShown');
		const now = Date.now();
		const oneDayMs = 24 * 60 * 60 * 1000;
		const isPreview = params.get('ios_donation_preview') === 'true';

		if (((isIOS || isSafari) && isEnglish) || isPreview) {
			if (isPreview || !lastShown || now - parseInt(lastShown) > oneDayMs) {
				showPopup = true;
				if (!isPreview) {
					localStorage.setItem('iosDonationLastShown', now.toString());
				}
			}
		}

		// Determine country from locale
		let country = 'US';
		if (lang.includes('-')) {
			country = lang.split('-')[1].toUpperCase();
		}

		const currencyMap: Record<string, string> = {
			GB: 'GBP',
			CA: 'CAD',
			AU: 'AUD',
			IE: 'EUR',
			NZ: 'NZD',
			ZA: 'ZAR'
		};

		currency = currencyMap[country] || 'USD';

		try {
			const res = await fetch('https://open.er-api.com/v6/latest/USD');
			const data = await res.json();
			if (data && data.rates && data.rates[currency]) {
				conversionRate = data.rates[currency];
			}
		} catch (e) {
			console.error('Failed to fetch exchange rates', e);
		}

		goalLocal = Math.round(goalUSD * conversionRate);
		currentLocal = currentUSD * conversionRate;

		try {
			const formatter = new Intl.NumberFormat(lang, { style: 'currency', currency: currency });
			// Extract symbol by formatting 0 and removing numbers/whitespace
			const parts = formatter.formatToParts(0);
			const currencyPart = parts.find((p) => p.type === 'currency');
			if (currencyPart) symbol = currencyPart.value;
		} catch (e) {
			if (currency === 'GBP') symbol = '£';
			else if (currency === 'EUR') symbol = '€';
			else symbol = '$';
		}
	});

	function formatMoney(amount: number) {
		return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: amount % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
	}

	function getDonationLink(amount: number | string) {
		if (amount === '') {
			return `https://opencollective.com/catenarymaps/donate/profile&hidePlatformTip=true&platformTip=0`;
		}
		const usdAmount = typeof amount === 'number' ? (amount / conversionRate).toFixed(2) : amount;
		return `https://opencollective.com/catenarymaps/donate?amount=${usdAmount}&platformTip=0`;
	}

	$: progressPercent = Math.min(100, Math.round((currentLocal / goalLocal) * 100)) || 0;
</script>

{#if showPopup}
	<div
		class="m-3 p-4 bg-sky-50 dark:bg-gray-800 border border-sky-300 dark:border-sky-700 rounded-xl shadow-md flex flex-col gap-3"
	>
		<h2 class="text-lg font-bold text-sky-900 dark:text-sky-100 leading-tight">
			Help us release Catenary Maps on iPhone & iPad!
		</h2>

		<p class="text-sm text-sky-800 dark:text-gray-300 leading-snug">
			We want to bring a native optimised experience to iOS but require a Mac Mini to code, compile,
			and test. If 15 people this week just donated the cost of 1 train ticket, we'd reach our goal
			and release the app in June. We're completely independent, free, and don't have adverts, so please
			take one moment to help us keep Catenary growing. Thank you.
		</p>

		<div class="w-full bg-sky-200 dark:bg-gray-700 rounded-full h-3 mt-1 overflow-hidden relative">
			<div
				class="bg-sky-600 dark:bg-sky-500 h-3 rounded-full"
				style="width: {progressPercent}%"
			></div>
		</div>
		<div class="flex justify-between text-xs font-semibold text-sky-700 dark:text-sky-300 mb-1">
			<span>{formatMoney(currentLocal)} raised</span>
			<span>{formatMoney(goalLocal)} goal</span>
		</div>

		<div class="flex flex-wrap gap-2 justify-center">
			{#each predefinedAmounts as amount}
				<a
					href={getDonationLink(amount)}
					target="_blank"
					rel="noopener noreferrer"
					class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm flex-1 text-center"
				>
					{formatMoney(amount)}
				</a>
			{/each}
			<a
				href={getDonationLink('')}
				target="_blank"
				rel="noopener noreferrer"
				class="px-3 py-1.5 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white rounded-lg font-medium text-sm flex-1 text-center"
			>
				Custom
			</a>
		</div>
	</div>
{/if}
