import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { readFileSync } from 'node:fs';
import JourneyRouteBadge from './JourneyRouteBadge.svelte';
import { itinerarySegments } from '$lib/features/directions/edelweiss';

describe('journey route symbols', () => {
	it.each(['A', 'B', 'C', 'D', 'E', 'K'])('renders the bundled LA Metro %s symbol from API long names', (line) => {
		const [segment] = itinerarySegments({startTime:'', endTime:'', legs:[{
			mode:'TRAM', routeShortName:null, routeLongName:`Metro ${line} Line`
		}]});
		const { body } = render(JourneyRouteBadge, { props: { segment } });
		const path = `/lametro/LACMTA_Circle_${line}_Line.svg`;
		expect(body).toContain(`src="${path}"`);
		expect(body).toContain(`alt="LA Metro ${line} Line"`);
		expect(readFileSync(`static${path}`, 'utf8')).toContain('<svg');
	});
});
