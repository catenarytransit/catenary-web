<script lang="ts">
	import { _, locale } from 'svelte-i18n';
	import { cause_id_str, effect_id_str } from './alert_id_to_str_key';
	import TimeDiff from './TimeDiff.svelte';
	import MtaBullet from './mtabullet.svelte';
	import { onDestroy } from 'svelte';
	import { condenseActivePeriods } from './alertTimeUtils'; // Adjust path accordingly

	export let alerts = {};
	export let default_tz: string | null = null;
	export let chateau: string | null = null;
	export let expanded: boolean = true;

	//get locale from the store

	let locale_code: string = 'en-CA'; // default
	let currentIndex = 0;
	let fading = false;
	let intervalId: NodeJS.Timeout;

	$: if ($locale) {
		if ($locale.startsWith('en')) {
			locale_code = 'en-CA';
		} else {
			locale_code = $locale;
		}
	}

	function alertLanguageCode(language: string): string {
		return language.replace(/-html$/, '').replaceAll('_', '-');
	}

	function alertLanguageLabel(language: string): string {
		return alertLanguageCode(language) || 'und';
	}

	function defaultAlertLanguage(languages: string[], currentLocale: string): string {
		const localeTag = currentLocale.replaceAll('_', '-');
		const localeLanguage = localeTag.split('-')[0];

		return (
			languages.find(
				(language) => alertLanguageCode(language).toLowerCase() === localeTag.toLowerCase()
			) ??
			languages.find(
				(language) =>
					alertLanguageCode(language).split('-')[0].toLowerCase() ===
					localeLanguage.toLowerCase()
			) ??
			languages[0]
		);
	}

	function translationsForLanguage(text: any, language: string): any[] {
		if (!text?.translation) return [];

		const exact = text.translation.find(
			(translation: any) => (translation.language || '') === language
		);
		const translation =
			exact ??
			text.translation.find(
				(translation: any) =>
					alertLanguageCode(translation.language || '').toLowerCase() ===
					alertLanguageCode(language).toLowerCase()
			);

		return translation ? [translation] : [];
	}

	function toggleLanguage(language: string) {
		if (selectedLanguages.has(language)) {
			if (selectedLanguages.size === 1) return;

			const next = new Set(selectedLanguages);
			next.delete(language);
			selectedLanguages = next;
			return;
		}

		selectedLanguages = new Set([...selectedLanguages, language]);
	}

	let languagelist: string[] = [];
	let languagelistToUse: string[] = [];
	let selectedLanguages = new Set<string>();
	let selectedLanguageSource = '';

	$: languagelist = [
		...new Set(
			(Object.values(alerts) as any[]).flatMap((alert: any) => {
				const translations = [
					...(alert.header_text?.translation || []),
					...(alert.description_text?.translation || []),
					...(alert.url?.translation || [])
				];

				return translations.map((translation: any) => translation.language || '');
			})
		)
	];

	$: languagelistToUse = (() => {
		if (languagelist.length === 0) return [''];

		const basesToHide = new Set(
			languagelist
				.filter((language) => language.endsWith('-html'))
				.map((language) => language.slice(0, -'-html'.length))
		);

		return languagelist.filter((language) => !basesToHide.has(language));
	})();

	$: {
		const nextLanguageSource = JSON.stringify([locale_code, languagelistToUse]);
		if (nextLanguageSource !== selectedLanguageSource) {
			selectedLanguageSource = nextLanguageSource;
			selectedLanguages = new Set([defaultAlertLanguage(languagelistToUse, locale_code)]);
		}
	}

	$: previewLanguageList = currentAlert
		? languagelistToUse.filter(
				(language) =>
					selectedLanguages.has(language) &&
					(translationsForLanguage(currentAlert.header_text, language).length > 0 ||
						translationsForLanguage(currentAlert.description_text, language).length > 0)
			)
		: [];

	// Cycling logic for collapsed state
	function startCycling() {
		stopCycling();
		if (Object.keys(alerts).length > 1) {
			intervalId = setInterval(() => {
				fading = true;
				setTimeout(() => {
					currentIndex = (currentIndex + 1) % Object.keys(alerts).length;
					fading = false;
				}, 500); // Wait for fade out
			}, 4000);
		} else {
			currentIndex = 0;
		}
	}

	function stopCycling() {
		if (intervalId) clearInterval(intervalId);
		fading = false;
	}

	function formatActivePeriodTime(value: number | null | undefined, locale: string, timeZone: string) {
		if (value == null) return '';
		return new Date(value * 1000)
			.toLocaleString(locale, {
				timeZone,
				dateStyle: 'short',
				timeStyle: 'short',
				hour12: false
			})
			.replace(/,/, '');
	}

	$: if (!expanded) {
		startCycling();
	} else {
		stopCycling();
	}

	onDestroy(() => {
		stopCycling();
	});

	$: currentAlert = Object.values(alerts)[currentIndex] as any;

	// Automatically compute compressed schedules when parameters adjust
	$: scheduleAnalysis = (alert: any) => {
		if (alert && alert.active_period) {
			return condenseActivePeriods(alert.active_period, locale_code, default_tz);
		}
		return null;
	};
</script>

{#if Object.keys(alerts).length > 0}
	<div class="border-[#F99C24] border leading-snug mb-3 p-2 rounded-md transition-all duration-300">
		<div
			class="flex flex-row items-start cursor-pointer"
			on:click={() => {
				expanded = !expanded;
			}}
		>
			<div class="flex-grow flex flex-col justify-center min-w-0">
				<div class="flex items-center">
					<img src="/icons/service_alert.svg" alt="(i)" class="h-6 w-6 inline mr-2" />
					<span
						class={`text-[#F99C24] font-semibold transition-all duration-300 ${expanded ? 'text-lg' : 'text-sm'}`}
					>
						{$_('service_alerts', {
							values: {
								n: Object.keys(alerts).length
							}
						})}
					</span>
				</div>

				{#if !expanded}
					<div
						class={`text-xs text-gray-400 dark:text-gray-300 transition-opacity duration-500 ${fading ? 'opacity-0' : 'opacity-100'}`}
					>
						{#if currentAlert}
							{#if currentAlert.header_text}
								{#each previewLanguageList as language}
									{#each translationsForLanguage(currentAlert.header_text, language) as each_header_translation_obj}
										<p class="truncate">
											<span class="font-bold">
												{#each each_header_translation_obj.text.split(/(\[[A-Z0-9]+\])/g) as part, i}
													{#if i % 2 === 1}
														<MtaBullet
															matchTextHeight={true}
															route_short_name={part.slice(1, -1)}
														/>
													{:else}
														{@html part.replaceAll(/\<(\/)?p\>/g, '').replaceAll(/\<(\/)?b\>/g, '')}
													{/if}
												{/each}
											</span>
										</p>
									{/each}
								{/each}
							{/if}

							{#if currentAlert.description_text}
								{#each previewLanguageList as language}
									{#each translationsForLanguage(currentAlert.description_text, language) as each_desc_translation_obj}
										<p class="truncate">
											{#each each_desc_translation_obj.text.split(/(\[[A-Z0-9]+\])/g) as part, i}
												{#if i % 2 === 1}
													<MtaBullet matchTextHeight={true} route_short_name={part.slice(1, -1)} />
												{:else}
													{@html part
														.replaceAll(/\<(\/)?p\>/g, '')
														.replaceAll(/\<(\/)?b\>/g, '')
														.replaceAll(/\\n/g, ' ')}
												{/if}
											{/each}
										</p>
									{/each}
								{/each}
							{/if}

							{#if !currentAlert.header_text && !currentAlert.description_text}
								{#if cause_id_str(currentAlert.cause) !== 'alert_cause_unknown_cause' || effect_id_str(currentAlert.effect) !== 'alert_effect_unknown_effect'}
									<p class="truncate text-gray-500 italic">
										{$_(cause_id_str(currentAlert.cause))} // {$_(effect_id_str(currentAlert.effect))}
									</p>
								{/if}
							{/if}
						{/if}
					</div>
				{/if}
			</div>

			<button class="w-6 h-6 rounded-full flex flex-col justify-center items-center ml-2">
				{#if expanded}
					<span class="material-symbols-outlined select-none"> collapse_content </span>
				{:else}
					<span class="material-symbols-outlined select-none"> expand_content </span>
				{/if}
			</button>
		</div>

		{#if expanded}
			<div class="mt-2 flex flex-row gap-2 overflow-x-auto pb-1" role="group" aria-label="Alert languages">
				{#each languagelistToUse as language}
					<button
						type="button"
						class={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
							selectedLanguages.has(language)
								? 'border-[#F99C24] bg-[#F99C24] text-black'
								: 'border-gray-400 bg-transparent text-gray-700 dark:border-gray-500 dark:text-gray-200'
						}`}
						aria-pressed={selectedLanguages.has(language)}
						on:click={() => toggleLanguage(language)}
					>
						{alertLanguageLabel(language)}
					</button>
				{/each}
			</div>
			<div class="py-0.5"></div>
			{#each Object.values(alerts) as alert}
				<div class="pt-1">
					<hr class="border-[#F99C24] border-0.5 rounded-xl" />
					{#if cause_id_str(alert.cause) !== 'alert_cause_unknown_cause' || effect_id_str(alert.effect) !== 'alert_effect_unknown_effect'}
						<p class="text-base font-medium text-[#F99C24] pt-1">
							<span class="">{$_(cause_id_str(alert.cause))}</span>
							<span> // </span>
							<span>{$_(effect_id_str(alert.effect))}</span>
						</p>
					{/if}

					{#if alert.url}
						{#each languagelistToUse.filter((language) => selectedLanguages.has(language)) as language}
							{#each translationsForLanguage(alert.url, language) as url_translation}
								<p class="text-sm">
									<span>{url_translation.language != null ? url_translation.language : ''}: </span><a
										href={url_translation.text}
										class="hover:underline text-sky-500 dark:text-sky-300"
										target="_blank">{url_translation.text}</a
									>
								</p>
							{/each}
						{/each}
					{/if}
					{#each languagelistToUse.filter((language) => selectedLanguages.has(language)) as language}
						{#if alert.header_text != null}
							{#each translationsForLanguage(alert.header_text, language) as each_header_translation_obj}
								<p class={`text-sm`}>
									{#each each_header_translation_obj.text.split(/(\[[A-Z0-9]+\])/g) as part, i}
										{#if i % 2 === 1}
											<MtaBullet matchTextHeight={true} route_short_name={part.slice(1, -1)} />
										{:else}
											{@html part.replaceAll(/\<(\/)?p\>/g, '').replaceAll(/\<(\/)?b\>/g, '')}
										{/if}
									{/each}
								</p>
							{/each}
						{/if}

						{#if alert.description_text != null}
							{#each translationsForLanguage(alert.description_text, language) as description_alert}
								<div class="leading-none">
									{#each description_alert.text.split('\n') as each_desc_line}
										<div class="text-xs pt-0.5">
											{#each each_desc_line.split(/(\[[A-Z0-9]+\])/g) as part, i}
												{#if i % 2 === 1}
													<MtaBullet matchTextHeight={true} route_short_name={part.slice(1, -1)} />
												{:else}
													{@html part
														.replaceAll(
															'<a ',
															'<a target="_blank" class="text-sky-500 dark:text-sky-300 underline"'
														)
														//.replaceAll(/\<(\/)?p\>/g, '')
														//.replaceAll(/\<(\/)?b\>/g, '')
														.replaceAll(/\\n/g, '<br/>')
														.replaceAll('https://rt.scmetro.org ', 'Catenary Maps ')
														.replaceAll(
															/(\[)?accessibility icon(\])?/g,
															'<span class="bg-blue-500 w-3 h-3 rounded-full inline"><svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" class="text-white fill-current inline"><path d="M320-80q-83 0-141.5-58.5T120-280q0-83 58.5-141.5T320-480v80q-50 0-85 35t-35 85q0 50 35 85t85 35q50 0 85-35t35-85h80q0 83-58.5 141.5T320-80Zm360-40v-200H440q-44 0-68-37.5t-6-78.5l74-164h-91l-24 62-77-22 28-72q9-23 29.5-35.5T350-680h208q45 0 68.5 36.5T632-566l-66 146h114q33 0 56.5 23.5T760-340v220h-80Zm-40-580q-33 0-56.5-23.5T560-780q0-33 23.5-56.5T640-860q33 0 56.5 23.5T720-780q0 33-23.5 56.5T640-700Z"/></svg></span>'
														)}
												{/if}
											{/each}
										</div>
									{/each}
								</div>
							{/each}
						{/if}
					{/each}

					{#if alert.active_period.length > 0}
						{@const schedule = scheduleAnalysis(alert)}

						<div
							class="mt-2 pt-1 dark:border-gray-700 text-xs"
						>
							{#if schedule && schedule.isCondensed}
								<p class="font-bold text-gray-800 dark:text-gray-200">
									{schedule.baseRule}
								</p>
								{#if schedule.weekdayRules}
									<p class="font-bold text-gray-800 dark:text-gray-200">
										{schedule.weekdayRules}
									</p>
								{/if}
								{#if schedule.exceptions}
									<p class="text-gray-800 dark:text-gray-200">
										<span class="font-bold">{schedule.exceptions.split(': ')[0]}:</span> {schedule.exceptions.split(': ').slice(1).join(': ')}
									</p>
								{/if}
							{:else if schedule}
								{@const tz = default_tz || Intl.DateTimeFormat().resolvedOptions().timeZone}
								{@const isNA = tz.startsWith('America/') || tz.startsWith('Canada/') || tz.startsWith('US/')}
								{@const fallbackLocale = isNA ? 'en-CA' : 'en-GB'}
								{#each schedule.fallbackPeriods as active_period}
									<p class="leading-relaxed">
										{formatActivePeriodTime(active_period.start, fallbackLocale, tz)}
										–
										{formatActivePeriodTime(active_period.end, fallbackLocale, tz)}
									</p>
								{/each}
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
{/if}
