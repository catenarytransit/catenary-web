export function hasActiveExpiry(key: string, now = Date.now()): boolean {
	const rawValue = localStorage.getItem(key);
	const expiresAt = rawValue ? Number(rawValue) : Number.NaN;

	if (Number.isFinite(expiresAt) && expiresAt > now) {
		return true;
	}

	if (rawValue !== null) {
		localStorage.removeItem(key);
	}

	return false;
}

export function setExpiry(key: string, durationMs: number, now = Date.now()): void {
	localStorage.setItem(key, String(now + durationMs));
}
