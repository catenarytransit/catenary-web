import { register, init, getLocaleFromNavigator } from 'svelte-i18n';

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
];

for (let i = 0; i < locale_list.length; i++) {
	register(locale_list[i], () => import(`./locales/${locale_list[i]}.json`));
}

export function getLocaleStorageOrNav() {
	if (typeof window != 'undefined') {
		if (window.localStorage.language && window.localStorage.language !== 'undefined') {
			return window.localStorage.language;
		} else {
			return getLocaleFromNavigator();
		}
	} else {
		return getLocaleFromNavigator();
	}
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
