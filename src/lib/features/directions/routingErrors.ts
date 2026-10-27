/**
 * Edelweiss replies with HTTP 422 for runtime routing errors as well as invalid
 * inputs. Do not hide its response body behind the browser's status text.
 */
export function explainEdelweissError(status: number, rawBody: string, contentType = ''): string {
	const detail = rawBody.trim().slice(0, 1200);
	const prefix = 'Edelweiss HTTP ' + status;

	if (status === 422 && /no single compiled transit region contains both endpoints/i.test(detail)) {
		return prefix + ': Neither endpoint pair is covered by the same compiled routing region. ' + detail;
	}
	if (status === 422 && /coordinate is outside all OSR regions/i.test(detail)) {
		return prefix + ': One or both locations are outside the loaded OSR walking regions. ' + detail;
	}
	if (status === 422 && /OSR geometry/i.test(detail)) {
		return prefix + ': Walking geometry reconstruction failed in Edelweiss. ' + detail;
	}
	if (status === 422 && /connecting to metadata database/i.test(detail)) {
		return prefix + ': Backend metadata database lookup failed. ' + detail;
	}
	if (contentType.includes('text/html')) {
		return prefix + ': Received an HTML error response instead of the routing API response. Check the upstream proxy or tunnel. ' +
			(detail ? 'First bytes: ' + detail.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 180) : '');
	}
	return prefix + (detail ? ': ' + detail : ': Empty error response. The server may not have generated diagnostic text.');
}
