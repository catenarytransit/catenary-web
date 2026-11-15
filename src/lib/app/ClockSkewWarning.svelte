<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { clock_skew_store } from '$root/globalstores';
	import { checkClockSync } from '$components/checkClockSync';

	// Only interrupt people for a clock error large enough to affect travel times.
	const WARNING_THRESHOLD_MS = 60_000;
	const RECHECK_INTERVAL_MS = 5 * 60_000;

	let dismissed = false;
	let lastWarnedOffset: number | null = null;

	$: skew = $clock_skew_store;
	$: significantSkew = skew !== null && Number.isFinite(skew) && Math.abs(skew) >= WARNING_THRESHOLD_MS;
	$: if (!significantSkew) {
		// A corrected clock should allow a future warning if it drifts again.
		dismissed = false;
		lastWarnedOffset = null;
	}
	$: if (significantSkew && skew !== null && lastWarnedOffset !== null &&
		Math.sign(skew) !== Math.sign(lastWarnedOffset)) {
		dismissed = false;
	}

	onMount(() => {
		let active = true;
		let checking = false;
		const check = async () => {
			if (!active || checking) return;
			checking = true;
			try {
				await checkClockSync();
			} finally {
				checking = false;
			}
		};
		void check();
		const interval = window.setInterval(() => void check(), RECHECK_INTERVAL_MS);
		const onVisibilityChange = () => {
			if (document.visibilityState === 'visible') void check();
		};
		document.addEventListener('visibilitychange', onVisibilityChange);
		return () => {
			active = false;
			window.clearInterval(interval);
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	});

	function dismiss() {
		dismissed = true;
		lastWarnedOffset = skew;
	}
</script>

{#if significantSkew && !dismissed && skew !== null}
	<div
		class="fixed left-1/2 top-4 z-[9999] flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-start gap-3 rounded-lg border border-amber-400 bg-amber-50 p-4 text-amber-950 shadow-lg dark:border-amber-600 dark:bg-amber-950 dark:text-amber-100"
		role="alert"
		aria-live="assertive"
	>
		<span aria-hidden="true" class="text-xl">⚠</span>
		<p class="min-w-0 flex-1 text-sm font-medium">
			{$_('clock_skew_warning', { values: { skew: Math.round(Math.abs(skew) / 1000) } })}
		</p>
		<button
			type="button"
			class="shrink-0 rounded border border-current px-2 py-1 text-sm font-semibold hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
			on:click={dismiss}
		>
			{$_('clock_skew_ignore')}
		</button>
	</div>
{/if}
