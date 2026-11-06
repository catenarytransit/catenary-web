// Decoy entry links must never be included in ordinary HTML.
// Fail closed unless trusted edge metadata positively identifies suspicious automation.
// We use UA only as an additional opt-out for legitimate search engines, never
// as positive proof that a request is automated.
import { claimsGoogleCrawler, type GoogleDnsVerification } from './google-crawler-dns';

export type BotSignals = {
	botManagement?: {
		score?: number;
		verifiedBot?: boolean;
	} | null;
	verifiedBotCategory?: string;
};

const SEARCH_ENGINE_UA =
	/(?:googlebot|googleother|google-inspectiontool|adsbot-google|mediapartners-google|bingbot|bingpreview|msnbot|duckduckbot|slurp|applebot|yandexbot|baiduspider|petalbot|mojeekbot|seznambot|qwantify|bravebot|exabot|sogou)/i;

export function shouldExposeHoneypotLinks(
	signals: BotSignals | undefined,
	userAgent: string | null,
	googleDnsVerification?: GoogleDnsVerification
): boolean {
	if (claimsGoogleCrawler(userAgent)) {
		// Verified Google traffic is excluded. DNS errors fail closed.
		if (googleDnsVerification !== 'unverified') return false;
	} else if (SEARCH_ENGINE_UA.test(userAgent ?? '')) return false;

	const bot = signals?.botManagement;
	if (!bot || bot.verifiedBot !== false) return false;
	if (signals?.verifiedBotCategory === 'Search Engine Crawler') return false;

	// Enterprise Bot Management only. No signals/zero score => no links.
	return typeof bot.score === 'number' &&
		Number.isInteger(bot.score) &&
		bot.score >= 1 &&
		bot.score < 20;
}
