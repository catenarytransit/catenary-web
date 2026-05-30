export interface ActivePeriod {
	start: number; // Unix timestamp in seconds
	end: number;   // Unix timestamp in seconds
}

export interface CondensedAlertSchedule {
	isCondensed: boolean;
	baseRule: string;
	weekdayRules: string;
	exceptions: string;
	fallbackPeriods: ActivePeriod[];
}

export function condenseActivePeriods(
	periods: ActivePeriod[],
	localeCode: string = 'en-CA',
	defaultTz: string | null = null
): CondensedAlertSchedule {
	if (!periods || periods.length <= 3) {
		return { isCondensed: false, baseRule: "", weekdayRules: "", exceptions: "", fallbackPeriods: periods || [] };
	}

	const timeZone = defaultTz || Intl.DateTimeFormat().resolvedOptions().timeZone;
	const lang = localeCode.split('-')[0].toLowerCase();
    
	const timeFormatter = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone });
	const weekdayFormatter = new Intl.DateTimeFormat(localeCode, { weekday: 'short', timeZone });

	const formatTime = (date: Date) => timeFormatter.format(date);
	const timeReplace = (t: string) => {
		if (lang === 'de' || lang === 'it') return t.replace(':', '.');
		if (lang === 'fr') return t.replace(':', 'h');
		return t;
	};

	const formatNightLabel = (start: Date, end: Date) => {
		const isSameDay = start.getDate() === end.getDate();
		if (lang === 'de') {
			const edf = new Intl.DateTimeFormat(localeCode, { day: '2-digit', month: '2-digit', timeZone });
			if (isSameDay) return `${edf.format(start)}`;
			const s = new Intl.DateTimeFormat(localeCode, { day: '2-digit', timeZone }).format(start);
			return `${s}./${edf.format(end)}`;
		} else if (lang === 'fr') {
			const smf = new Intl.DateTimeFormat(localeCode, { month: 'long', timeZone }).format(start).toLowerCase();
			if (isSameDay) return `${start.getDate()} ${smf}`;
			return `${start.getDate()}/${end.getDate()} ${smf}`;
		} else if (lang === 'it') {
			const smf = new Intl.DateTimeFormat(localeCode, { month: 'long', timeZone }).format(start).toLowerCase();
			if (isSameDay) return `${start.getDate()} ${smf}`;
			return `${start.getDate()}/${end.getDate()} ${smf}`;
		} else {
			const smf = new Intl.DateTimeFormat(localeCode, { month: 'short', timeZone }).format(start);
			if (isSameDay) return `${smf} ${start.getDate()}`;
			return `${smf} ${start.getDate()}/${end.getDate()}`;
		}
	};

	const nights = periods.map(p => {
		const start = new Date(p.start * 1000);
		const end = new Date(p.end * 1000);
		
		let startWk = weekdayFormatter.format(start).replace(/\.$/, '');
		let endWk = weekdayFormatter.format(end).replace(/\.$/, '');
		
		// capitalize first letter if not already
		startWk = startWk.charAt(0).toUpperCase() + startWk.slice(1);
		endWk = endWk.charAt(0).toUpperCase() + endWk.slice(1);
		
		return {
			originalStart: start,
			startDate: start.getTime(),
			startTime: formatTime(start),
			endTime: formatTime(end),
			weekdayPair: start.getDate() !== end.getDate() ? `${startWk}/${endWk}` : startWk,
			label: formatNightLabel(start, end),
			raw: p
		};
	});

	nights.sort((a, b) => a.startDate - b.startDate);

	const firstLabel = nights[0].label;
	const lastLabel = nights[nights.length - 1].label;

	const patternCounts: Record<string, number> = {};
	nights.forEach(n => {
		const key = `${n.startTime}|${n.endTime}`;
		patternCounts[key] = (patternCounts[key] || 0) + 1;
	});

	let bestPattern = "";
	let maxCount = -1;
	for (const [k, v] of Object.entries(patternCounts)) {
		if (v > maxCount) {
			maxCount = v;
			bestPattern = k;
		}
	}

	const [baseStart, baseEnd] = bestPattern.split('|');

	const deviations = [];
	for (const n of nights) {
		if (!(n.startTime === baseStart && n.endTime === baseEnd)) {
			deviations.push(n);
		}
	}

	const groupMap: Record<string, typeof deviations> = {};
	deviations.forEach(n => {
		const key = `${n.weekdayPair}|${n.startTime}|${n.endTime}`;
		if (!groupMap[key]) groupMap[key] = [];
		groupMap[key].push(n);
	});

	const weekdayRules: string[] = [];
	const exceptions: typeof deviations = [];

	for (const group of Object.values(groupMap)) {
		if (group.length >= 2) {
			const sample = group[0];
			const wPair = sample.weekdayPair;
			const sStart = timeReplace(sample.startTime);
			const sEnd = timeReplace(sample.endTime);

			if (sample.startTime === baseStart) {
				if (lang === 'de') weekdayRules.push(`${wPair} bis ${sEnd} Uhr`);
				else if (lang === 'fr') weekdayRules.push(`${wPair} jusqu’à ${sEnd}`);
				else if (lang === 'it') weekdayRules.push(`${wPair} fino alle ${sEnd}`);
				else weekdayRules.push(`${wPair} until ${sEnd}`);
			} else {
				if (lang === 'de') weekdayRules.push(`${wPair} ${sStart}–${sEnd} Uhr`);
				else if (lang === 'fr') weekdayRules.push(`${wPair} de ${sStart} à ${sEnd}`);
				else if (lang === 'it') weekdayRules.push(`${wPair} ${sStart}–${sEnd}`);
				else weekdayRules.push(`${wPair} ${sStart}–${sEnd}`);
			}
		} else {
			exceptions.push(group[0]);
		}
	}

	const exceptionText = exceptions.map(e => {
		if (lang === 'fr') {
			return `${e.label}, de ${timeReplace(e.startTime)} à ${timeReplace(e.endTime)}`;
		} else if (lang === 'de') {
			return `${e.label}, ${timeReplace(e.startTime)}–${timeReplace(e.endTime)} Uhr`;
		} else {
			return `${e.label}, ${timeReplace(e.startTime)}–${timeReplace(e.endTime)}`;
		}
	});

	let baseRule = "";
	let exceptionsStr = "";
	let rulesStr = weekdayRules.join(lang === 'de' || lang === 'fr' || lang === 'it' ? ', ' : '; ');

	const bs = timeReplace(baseStart);
	const be = timeReplace(baseEnd);
	const lastYear = nights[nights.length - 1].originalStart.getFullYear();

	if (lang === 'de') {
		baseRule = `Nächte ${firstLabel}–${lastLabel} ${lastYear}, jeweils ${bs}–${be} Uhr`;
		exceptionsStr = exceptionText.length > 0 ? `Ausnahmen: ${exceptionText.join('; ')}` : "";
	} else if (lang === 'fr') {
		baseRule = `Nuits du ${firstLabel} au ${lastLabel} ${lastYear}, de ${bs} à ${be}`;
		exceptionsStr = exceptionText.length > 0 ? `Exceptions : ${exceptionText.join('; ')}` : "";
	} else if (lang === 'it') {
		baseRule = `Notti dal ${firstLabel} all’${lastLabel} ${lastYear}, ${bs}–${be}`;
		exceptionsStr = exceptionText.length > 0 ? `Eccezioni: ${exceptionText.join('; ')}` : "";
	} else {
		baseRule = `Nights ${firstLabel}–${lastLabel}, ${lastYear}, ${bs}–${be}`;
		exceptionsStr = exceptionText.length > 0 ? `Exceptions: ${exceptionText.join('; ')}` : "";
	}

	return {
		isCondensed: true,
		baseRule,
		weekdayRules: rulesStr,
		exceptions: exceptionsStr,
		fallbackPeriods: []
	};
}