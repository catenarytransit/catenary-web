import { addMessages, getLocaleFromNavigator, init, register } from 'svelte-i18n';
import en from './locales/en.json';

//sort like Google / YouTube
const locale_list = [
	'ca',
	'da',
	'de',
	'et',
	'en',
	'es',
	'fr',
	'oc',
	'lb',
	'ga',
	'hr',
	'it',
	'lt',
	'lv',
	'nl',
	'hu',
	'no',
	'pl',
	'pt-PT',
	'ro',
	'sk',
	'sl',
	'sr',
	'fi',
	'sv',
	'ru',
	'uk',
	'el',
	'zh-CN',
	'zh-TW',
	'ja',
	'ko'
] as const;

const supportedLocales = new Set<string>(locale_list);

addMessages('en', en);

for (const supportedLocale of locale_list) {
	if (supportedLocale === 'en') {
		continue;
	}
	register(supportedLocale, () => import(`./locales/${supportedLocale}.json`));
}

export function normalizeLocale(value: string | null | undefined): string {
	if (!value || value === 'undefined') {
		return 'en';
	}

	const normalized = value.replace(/_/g, '-');
	if (supportedLocales.has(normalized)) {
		return normalized;
	}

	const lower = normalized.toLowerCase();
	if (lower.startsWith('zh')) {
		const traditionalChinese =
			lower.includes('tw') ||
			lower.includes('hk') ||
			lower.includes('mo') ||
			lower.includes('hant');
		return traditionalChinese ? 'zh-TW' : 'zh-CN';
	}

	if (lower.startsWith('pt')) {
		return 'pt-PT';
	}

	if (lower.startsWith('nb') || lower.startsWith('nn')) {
		return 'no';
	}

	const base = lower.split('-')[0];
	return locale_list.find((supportedLocale) => supportedLocale.toLowerCase() === base) ?? 'en';
}

export function getLocaleStorageOrNav(): string {
	if (typeof window === 'undefined') {
		return 'en';
	}

	const storedLocale = window.localStorage.language;
	if (storedLocale && storedLocale !== 'undefined') {
		return normalizeLocale(storedLocale);
	}

	return normalizeLocale(getLocaleFromNavigator());
}

export function init_locales() {
	init({
		fallbackLocale: 'en',
		initialLocale: getLocaleStorageOrNav()
	});
}

export const locales_options: Record<string, string> = {
	ca: 'Català',
	en: 'English',
	fr: 'Français',
	oc: 'Occitan',
	es: 'Español',
	da: 'Dansk',
	de: 'Deutsch',
	ga: 'Gaeilge',
	ko: '한국어',
	lb: 'Lëtzebuergesch',
	'zh-CN': '中文 (简体)',
	'zh-TW': '中文 (繁體)',
	nl: 'Nederlands',
	ja: '日本語',
	it: 'Italiano',
	pl: 'Polski',
	ru: 'Русский',
	'pt-PT': 'Português Europeu',
	ro: 'Română',
	uk: 'Українська',
	sv: 'Svenska',
	fi: 'Suomi',
	sl: 'Slovenščina',
	no: 'Norsk',
	sr: 'Srpski',
	hu: 'Magyar',
	lv: 'Latviešu valoda',
	et: 'Eesti',
	hr: 'Hrvatski',
	el: 'Ελληνικά',
	lt: 'Lietuvių',
	sk: 'Slovenčina'
};

export const locales_options_lookup: Record<string, string> = {
	ca: 'Català',
	en: 'English',
	fr: 'Français',
	oc: 'Occitan',
	es: 'Español',
	de: 'Deutsch',
	da: 'Dansk',
	ga: 'Gaeilge',
	ko: '한국어',
	lb: 'Lëtzebuergesch',
	zh: '中文',
	ru: 'Русский',
	'zh-CN': '中文 (简体)',
	'zh-TW': '中文 (繁體)',
	nl: 'Nederlands',
	ja: '日本語',
	it: 'Italiano',
	pl: 'Polski',
	'pt-PT': 'Português Europeu',
	ro: 'Română',
	uk: 'Українська',
	sv: 'Svenska',
	fi: 'Suomi',
	sl: 'Slovenščina',
	no: 'Norsk',
	sr: 'Srpski',
	hu: 'Magyar',
	lv: 'Latviešu valoda',
	et: 'Eesti',
	hr: 'Hrvatski',
	el: 'Ελληνικά',
	lt: 'Lietuvių',
	sk: 'Slovenčina'
};
