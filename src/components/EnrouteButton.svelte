<script lang="ts">
	import { _ } from 'svelte-i18n';

	type EnrouteMode = 'station' | 'enroute' | 'jr-enroute' | 'home';

	/** The Enroute mode/page type to link to */
	export let mode: EnrouteMode = 'home';

	/** The chateau ID (data source identifier) - required for modes other than 'home' */
	export let chateau: string | undefined = undefined;

	/** Stop ID to link to - required when mode is 'station' */
	export let stop_id: string | undefined = undefined;

	/** Trip ID to link to - required when mode is 'enroute' or 'jr-enroute' */
	export let trip_id: string | undefined = undefined;

	/** Additional CSS classes to apply to the button */
	export let classNames: string = '';

	function buildUrl(): string {
		const baseUrl = 'https://enroute.catenarymaps.org';

		if (mode === 'home') {
			return baseUrl;
		}

		const params = new URLSearchParams();

		if (chateau) params.set('chateau', chateau);
		if (stop_id && mode === 'station') params.set('stop', stop_id);
		if (trip_id && (mode === 'enroute' || mode === 'jr-enroute')) params.set('trip', trip_id);

		return `${baseUrl}/${mode}?${params.toString()}`;
	}
</script>

<a
	href={buildUrl()}
	target="_blank"
	rel="noopener noreferrer"
	class="text-seashore dark:text-seashoredark cursor-pointer mx-1 {classNames}"
	title={$_('openInEnroute')}
>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="w-5 h-5"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<rect width="20" height="16" x="2" y="4" rx="2" />
		<path d="M12 9v11" />
		<path d="M2 9h13a2 2 0 0 1 2 2v9" />
	</svg>
</a>
