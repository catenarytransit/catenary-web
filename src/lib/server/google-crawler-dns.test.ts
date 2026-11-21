import { describe, expect, it } from 'vitest';
import {
	claimsGoogleCrawler,
	isGoogleHostname,
	parseIpAddress,
	reverseDnsName,
	verifyGoogleCrawlerIp,
	type DnsLookup
} from './google-crawler-dns';
import { shouldExposeHoneypotLinks } from './honeypot-gate';

const dns: DnsLookup = async (name, type) => {
	if (type === 'PTR' && name === '1.66.249.66.in-addr.arpa') {
		return ['crawl-66-249-66-1.googlebot.com.'];
	}
	if (name === 'crawl-66-249-66-1.googlebot.com' && type === 'A') {
		return ['66.249.66.1'];
	}
	return [];
};

describe('Google crawler FCrDNS', () => {
	it('recognizes Google UA claims without trusting them', () => {
		expect(claimsGoogleCrawler('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
		expect(claimsGoogleCrawler('Mozilla/5.0')).toBe(false);
	});
	it('checks exact hostname label suffixes', () => {
		expect(isGoogleHostname('crawl-66-249-66-1.googlebot.com.')).toBe(true);
		expect(isGoogleHostname('crawl.googlebot.com.evil.example')).toBe(false);
		expect(isGoogleHostname('fakegooglebot.com')).toBe(false);
	});
	it('parses v4 and v6 and rejects injection', () => {
		expect(parseIpAddress('66.249.66.1')).toEqual([66, 249, 66, 1]);
		expect(parseIpAddress('2001:db8::1')).toHaveLength(16);
		expect(reverseDnsName('66.249.66.1')).toBe('1.66.249.66.in-addr.arpa');
		expect(parseIpAddress('66.249.66.1, 127.0.0.1')).toBeNull();
	});
	it('verifies a matching PTR and A record', async () => {
		expect(await verifyGoogleCrawlerIp('66.249.66.1', dns)).toBe('verified');
	});
	it('rejects PTR spoofing when forward lookup differs', async () => {
		const wrongDns: DnsLookup = async (name, type) =>
			type === 'PTR' ? ['googlebot.com.'] : ['203.0.113.5'];
		expect(await verifyGoogleCrawlerIp('66.249.66.1', wrongDns)).toBe('unverified');
	});
	it('distinguishes DNS errors from failed verification', async () => {
		const fail: DnsLookup = async () => { throw new Error('timeout'); };
		expect(await verifyGoogleCrawlerIp('66.249.66.1', fail)).toBe('error');
	});
	it('never exposes decoys to verified Google or on DNS error', () => {
		const signals = { botManagement: { verifiedBot: false, score: 5 } };
		const ua = 'Mozilla/5.0 Googlebot/2.1';
		expect(shouldExposeHoneypotLinks(signals, ua, 'verified')).toBe(false);
		expect(shouldExposeHoneypotLinks(signals, ua, 'error')).toBe(false);
		expect(shouldExposeHoneypotLinks(signals, ua, 'unverified')).toBe(true);
		expect(shouldExposeHoneypotLinks(undefined, ua, 'unverified')).toBe(false);
	});
});
