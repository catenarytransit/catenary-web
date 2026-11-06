import type { RequestHandler } from './$types';
import { honeypotResponse } from '$lib/server/honeypot';

export const prerender = false;

export const GET: RequestHandler = () => honeypotResponse(0);
