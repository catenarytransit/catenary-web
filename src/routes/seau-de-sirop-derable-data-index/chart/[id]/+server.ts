import type { RequestHandler } from './$types';
import { honeypotResponse, PAGE_COUNT } from '$lib/server/honeypot';

export const prerender = false;

export const GET: RequestHandler = ({ params }) => {
	// Avoid uncontrolled URL depth, parameter amplification, and unbounded IDs.
	if (!/^(0|[1-9][0-9]{0,4})$/.test(params.id)) {
		return new Response('Not found', { status: 404 });
	}
	const id = Number(params.id);
	if (id >= PAGE_COUNT) {
		return new Response('Not found', { status: 404 });
	}
	return honeypotResponse(id);
};
