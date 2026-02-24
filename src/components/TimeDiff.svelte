<script lang="ts">
	import { _ } from 'svelte-i18n';

	import { locale, locales } from 'svelte-i18n';
	export let diff: number;
	export let show_brackets: boolean = true;

	export let show_seconds: boolean = false;

	export let large: boolean = false;

	let textclass: string = 'slashed-zero tabular-nums';

	export let use_ticks = false;

	let h: number = 0;
	let m: number = 0;
	let s: number = 0;
	let d: number = 0;

	export let show_days: boolean = false;

	export let show_plus: boolean = false;

	export let space_between: boolean = true;

	export let stylesForUnits: string = '';

	setInterval;

	let this_locale: string | null | undefined = null;

	function locale_hour_marking(l: string | null | undefined) {
		if (typeof l == 'string') {
			if (l == 'zh' || l == 'zh-CN' || l == 'zh_CN') {
				return '小时';
			}
			if (l == 'zh-TW' || l == 'zh_TW') {
				return '小時';
			}

			if (l.startsWith('ko')) {
				return '시간';
			}

			if (l.startsWith('ja')) {
				return '時間';
			}
		}

		return 'h';
	}

	function locale_day_marking(l: string | null | undefined) {
		if (typeof l == 'string') {
			if (l == 'zh' || l == 'zh-CN' || l == 'zh_CN') {
				return '天';
			}
			if (l == 'zh-TW' || l == 'zh_TW') {
				return '天';
			}

			if (l.startsWith('ko')) {
				return '일';
			}

			if (l.startsWith('ja')) {
				return '日';
			}
		}

		return 'd';
	}

	function locale_min_marking(l: string | null | undefined) {
		if (typeof l == 'string') {
			if (l == 'zh' || l == 'zh-CN') {
				return '分';
			}
			if (l == 'zh-TW' || l == 'zh_TW') {
				return '分';
			}
			if (l.startsWith('ko')) {
				return '분';
			}

			if (l.startsWith('ja')) {
				return '分';
			}
		}

		if (use_ticks) {
			if (l.startsWith('fr')) {
				return "'";
			}
		}

		return 'min';
	}

	function locale_s_marking(l: string | null | undefined) {
		if (typeof l == 'string') {
			if (l == 'zh' || l == 'zh-CN') {
				return '秒';
			}
			if (l == 'zh-TW') {
				return '秒';
			}
			if (l.startsWith('ko')) {
				return '초';
			}

			if (l.startsWith('ja')) {
				return '秒';
			}
		}

		if (l.startsWith('fr') && use_ticks == true) {
			return '"';
		}

		return 's';
	}

	locale.subscribe((x) => (this_locale = x));

	let m_string = '';
	let s_string = '';

	$: if (diff) {
		let remainder = Math.floor(Math.abs(diff));
		if (show_days) {
			d = Math.floor(remainder / 86400);
			remainder = remainder - d * 86400;
		}

		h = Math.floor(remainder / 3600);
		remainder = remainder - h * 3600;
		m = Math.floor(remainder / 60);
		remainder = remainder - m * 60;
		s = remainder;

		if (h > 0) {
			if (m < 10) {
				m_string = '0' + m.toString();
			} else {
				m_string = m.toString();
			}
		} else {
			m_string = m.toString();
		}

		if (m > 0) {
			if (s < 10) {
				s_string = '0' + s.toString();
			} else {
				s_string = s.toString();
			}
		} else {
			s_string = s.toString();
		}
	}
</script>

<span class={large ? '' : 'text-[0px]'}>
	<span class={large ? 'text-lg ' : 'text-sm'}>
		{#if show_brackets}{'['}{/if}

		<span class="font-bold">
			{#if diff < 0}{'-'}{/if}{#if diff > 0}{show_plus ? '+' : ''}{/if}
		</span>
	</span>
	{#if d > 0}
		<span class={large ? 'text-lg' : 'text-sm'}>{d}</span>
		<span class={`${large ? 'text-sm' : 'text-xs'} ${stylesForUnits}`}
			>{locale_day_marking(this_locale)}</span
		>
	{/if}
	{#if h > 0}
		<span class={large ? 'text-sm' : 'text-sm'}>{h}</span>
		<span class={`${large ? 'text-sm' : 'text-xs'}  ${stylesForUnits}`}
			>{#if space_between}
				<span class="px-0.5"></span>
			{/if}{locale_hour_marking(this_locale)}</span
		>
	{/if}
	{#if space_between}
		<span class="px-0.5"></span>
	{/if}
	{#if h > 0 || m > 0 || (!show_seconds && m >= 0 && diff != 0)}
		<span class="{large ? 'text-base' : 'text-sm'} tabular-nums">{m_string}</span>
		<span class={`${large ? 'text-sm' : 'text-xs'}  ${stylesForUnits}`}
			>{#if space_between}
				<span class="px-0.5"></span>
			{/if}{locale_min_marking(this_locale)}</span
		>
	{/if}
	{#if show_seconds}
		<span class="{large ? 'text-base' : 'text-sm'} tabular-nums">{s_string}</span>
		<span class={`${large ? 'text-sm' : 'text-xs'}  ${stylesForUnits}`}>
			{#if space_between}
				<span class="px-0.5"></span>
			{/if}
			{locale_s_marking(this_locale)}</span
		>
	{/if}

	{#if show_brackets}
		<span class={large ? 'text-lg' : 'text-sm'}>{']'}</span>
	{/if}
</span>
