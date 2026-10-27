/** WCAG contrast for decorative connector lines against the details card surfaces. */
const MIN_RAIL_CONTRAST = 3;

function luminance(hex: string): number {
	const [red, green, blue] = [0, 2, 4]
		.map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
		.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
	return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

// Tailwind's gray-800 card background (#1f2937); the light card background is white.
const DARK_CARD_LUMINANCE = luminance('1f2937');

/** Prefer the actual route colour, falling back to black/white when unavailable or low contrast. */
export function connectionRailColor(routeColor: string | null | undefined, dark: boolean): string {
	const fallback = dark ? '#ffffff' : '#000000';
	const raw = routeColor?.trim().replace(/^#/, '') ?? '';
	if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return fallback;

	const hex = (raw.length === 3 ? raw.split('').map(channel => channel + channel).join('') : raw).toLowerCase();
	const colorLuminance = luminance(hex);
	const backgroundLuminance = dark ? DARK_CARD_LUMINANCE : 1;
	const contrast = (Math.max(colorLuminance, backgroundLuminance) + 0.05) /
		(Math.min(colorLuminance, backgroundLuminance) + 0.05);

	return contrast >= MIN_RAIL_CONTRAST ? `#${hex}` : fallback;
}
