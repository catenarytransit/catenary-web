<script lang="ts">
	import { getLocaleFromNavigator, locale, locales, _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import {
		data_stack_store,
		usunits_store,
		show_gtfs_ids_store,
		ui_theme_store,
		show_seconds_store,
		show_stop_codes_store,
		show_countdown_to_stop_store,

		make_ui_fonts_list,

		ui_font_store


	} from '../globalstores';

	import { livedotscaling_store } from '../fontscalingstores';
	import HomeButton from './SidebarParts/home_button.svelte';

	import { locales_options, locales_options_lookup } from '../i18n';
	import { onMount } from 'svelte';

	let this_locale: string | undefined | null;
	import { getLocaleStorageOrNav } from '../i18n';
	import { init_stores } from './init_stores';
	init_stores();

	import { consentGiven } from '../globalstores';

	let consentGivenThisComponent = get(consentGiven);

	consentGiven.subscribe((value) => {
		consentGivenThisComponent = value;

		localStorage.setItem('cookie_consent', String(value));
	});

	onMount(() => {
		const consent = localStorage.getItem('cookie_consent');
		if (consent === 'true') {
			consentGiven.set(true);
		} else if (consent === 'false') {
			consentGiven.set(false);
		}
	});

	let show_seconds = get(show_seconds_store);

	let theme_selector = get(ui_theme_store);

	let live_dots_scale = get(livedotscaling_store);

	let font_selector = get(ui_font_store).postscript_font_name[0];

	show_seconds_store.subscribe((value) => {
		show_seconds = value;
	});

	livedotscaling_store.subscribe((value) => {
		live_dots_scale = value;
	});

	ui_theme_store.subscribe((value) => {
		theme_selector = value;
	});

	ui_font_store.subscribe((value) => {
		font_selector = value.postscript_font_name[0];
	});

	function locale_code_to_name(locale: string | null | undefined) {
		if (locale == null || locale == undefined) {
			return '--';
		} else {
			let temp = locales_options_lookup[locale];
			if (temp == null || temp == undefined) {
				return locale;
			} else {
				return temp;
			}
		}
	}

	locale.subscribe((newval) => {
		this_locale = newval;
	});

	let show_gtfs_ids = get(show_gtfs_ids_store);

	show_gtfs_ids_store.subscribe((value) => {
		show_gtfs_ids = value;
	});

	const commitID = _COMMIT_ID;
	const commitDate = _COMMIT_DATE;
</script>

<HomeButton />
<div class="px-3 pt-1 flex flex-col h-full select-text">
	<h1 class="text-3xl font-medium mb-2">{$_('settings')}</h1>
	<span class="text-xl block">{$_('language')}</span>
	<p>{$locale}</p>
	<select
		bind:value={$locale}
		class="text-black bg-white dark:bg-gray-900 dark:text-white p-1 border-2 my-1 border-seashore dark:border-seashoredark rounded-md"
	>
		{#each $locales as locale}
			<option value={locale} class="text-black bg-white dark:bg-gray-900 dark:text-white"
				>{locale_code_to_name(locale)}</option
			>
		{/each}
	</select>
	<span class="block my-2"></span>
	<span class="text-xl block mb-1">{$_('mapstyle')}</span>

	<!-- Radio selector -->
	<div class="mb-2">
		<div class="">
			<input
				type="radio"
				id="system"
				name="system"
				value="system"
				checked={theme_selector === 'system'}
				on:click={() => {
					ui_theme_store.set('system');
				}}
			/>
			<label for="system">{$_('system_theme')}</label>
		</div>
		<div>
			<input
				type="radio"
				id="light"
				name="light"
				value="light"
				checked={theme_selector === 'light'}
				on:click={() => {
					ui_theme_store.set('light');
				}}
			/>
			<label for="system">{$_('light_theme')}</label>
		</div>
		<div>
			<input
				type="radio"
				id="dark"
				name="dark"
				value="dark"
				checked={theme_selector === 'dark'}
				on:click={() => {
					ui_theme_store.set('dark');
				}}
			/>
			<label for="dark">{$_('dark_theme')}</label>
		</div>
	</div>

	<!-- Radio selector -->
	<div class="mb-2">
		<div class="">
			<input
				type="radio"
				id="system"
				name="system"
				value="system"
				checked={font_selector === 'Barlow'}
				on:click={() => {
					ui_font_store.set(make_ui_fonts_list("Barlow", "Barlow"));
				}}
			/>
			<label for="system">Barlow</label>
		</div>
		<div>
			<input
				type="radio"
				id="light"
				name="light"
				value="light"
				checked={font_selector === 'NotoSans'}
				on:click={() => {
					ui_font_store.set(make_ui_fonts_list("Noto Sans", "NotoSans"));
				}}
			/>
			<label for="system">Noto Sans</label>
		</div>
		<div>
			<input
				type="radio"
				id="dark"
				name="dark"
				value="dark"
				checked={font_selector === 'Arimo'}
				on:click={() => {
					ui_font_store.set(make_ui_fonts_list("Arimo", "Arimo"));
				}}
			/>
			<label for="dark">Arimo</label>
		</div>
	</div>

	<div class="flex flex-row gap-x-2">
		<input
			type="checkbox"
			checked={get(usunits_store)}
			class="accent-seashore"
			on:click={() => {
				usunits_store.update((x) => !x);
				window.localStorage.usunits = get(usunits_store);
			}}
			on:keydown={(e) => {
				if (e.key === 'Enter') {
					usunits_store.update((x) => !x);
					window.localStorage.usunits = get(usunits_store);
				}
			}}
		/>
		<p>{$_('useUSunits')}</p>
	</div>
	<div class="flex flex-row gap-x-2">
		<input
			type="checkbox"
			checked={get(show_gtfs_ids_store)}
			class="accent-seashore"
			on:click={() => {
				show_gtfs_ids_store.update((x) => !x);
				window.localStorage.show_gtfs_ids = get(show_gtfs_ids_store);
			}}
			on:keydown={(e) => {
				if (e.key === 'Enter') {
					show_gtfs_ids_store.update((x) => !x);
					window.localStorage.show_gtfs_ids = get(show_gtfs_ids_store);
				}
			}}
		/>
		<p>{$_('show_gtfs_ids')}</p>
	</div>

	<div class="flex flex-row gap-x-2">
		<input
			type="checkbox"
			checked={get(show_stop_codes_store)}
			class="accent-seashore"
			on:click={() => {
				show_stop_codes_store.update((x) => !x);
				window.localStorage.show_stop_codes = get(show_stop_codes_store);
			}}
			on:keydown={(e) => {
				if (e.key === 'Enter') {
					show_stop_codes_store.update((x) => !x);
					window.localStorage.show_stop_codes = get(show_stop_codes_store);
				}
			}}
		/>
		<p>{$_('show_stop_codes')}</p>
	</div>

	<div class="flex flex-row gap-x-2">
		<input
			type="checkbox"
			class="accent-seashore"
			checked={show_seconds}
			on:click={(e) => {
				show_seconds_store.set(e.target.checked);
			}}
			on:keydown={(e) => {
				show_seconds_store.set(e.target.checked);
			}}
		/>
		<p>{$_('show_seconds_in_trips')}</p>
	</div>

	<div class="flex flex-row gap-x-2">
		<input
			type="checkbox"
			class="accent-seashore"
			checked={get(show_countdown_to_stop_store)}
			on:click={() => {
				show_countdown_to_stop_store.update((x) => !x);
				window.localStorage.show_countdown_to_stop = get(show_countdown_to_stop_store);
			}}
			on:keydown={(e) => {
				if (e.key === 'Enter') {
					show_countdown_to_stop_store.update((x) => !x);
					window.localStorage.show_countdown_to_stop = get(show_countdown_to_stop_store);
				}
			}}
		/>
		<p>{$_('show_countdown')}</p>
	</div>

	<div class="text-xl">
		{$_('dotfontscaling')}
	</div>

	<div class="my-2">
		<div class="flex flex-row text-md gap-x-3 align-middle">
			<p class="text-lg my-auto font-mono">{live_dots_scale.toFixed(1)}</p>

			<div class=" select-none flex flex-row rounded-2xl bg-gray-50 dark:bg-gray-800">
				<div class="border-2 border-gray-300 dark:border-gray-600 rounded-2xl flex flex-row">
					<div
						class="select-none flex-1 flex items-center justify-center py-2 px-4 cursor-pointer"
						on:click={() => {
							livedotscaling_store.update((s) => Math.max(0.1, s - 0.1));
						}}
					>
						<p>{'-'}</p>
					</div>
					<div class="border-l-2 border-gray-300 dark:border-gray-600">
						<div
							class="select-none flex-1 flex items-center justify-center py-2 px-4 cursor-pointer"
							on:click={() => {
								livedotscaling_store.update((s) => s + 0.1);
							}}
						>
							<p>{'+'}</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="flex flex-row gap-x-2">
		<input
			type="checkbox"
			class="accent-seashore"
			checked={consentGivenThisComponent}
			on:click={(e) => {
				consentGivenThisComponent = e.target.checked;
				consentGiven.set(e.target.checked);
			}}
			on:keydown={(e) => {
				consentGivenThisComponent = e.target.checked;
				consentGiven.set(e.target.checked);
			}}
		/>
		<p>{$_('consentsettinganalytics')}</p>
	</div>

	{#if commitID}
		<a
			target={'_blank'}
			href="https://github.com/catenarytransit/catenary-frontend/commit/{commitID}"
		>
			<br />{$_('commitid')}: <u>{commitID.substring(0, 7)}</u>
		</a>
	{/if}
	{#if commitDate}
		<p>{$_('commitdate')}: {commitDate}</p>
	{/if}
</div>
