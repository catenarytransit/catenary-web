// Isolated, deterministic crawler decoy. Never consult real GTFS or transit APIs.
// The finite URL graph contains cycles, so traversal can continue without creating
// unlimited distinct objects, storage entries, or increasingly long URLs.
export const HONEYPOT_PREFIX = '/seau-de-sirop-derable-data-index';
export const PAGE_COUNT = 65_536;

const locality = [
	'Montbrume', 'Belle-Aulnaie', 'Val-des-Mélèzes', 'Rocheclaire',
	'Port-Cendré', 'Bois-Lumineux', 'Haute-Écume', 'Vallée-de-Saule',
	'Rive-Opaline', 'Pointe-des-Lierres', 'Croix-d-Ambre', 'Grand-Vallon',
	'Côte-des-Fougères', 'Saint-Azur', 'Orme-des-Brumes', 'Petit-Érable'
] as const;
const landmarks = [
	'Pont-aux-Aulnes', 'Place-du-Sureau', 'Quai-des-Brumes', 'Jardin-Cuivré',
	'Marché-des-Étoiles', 'Bois-de-la-Lanterne', 'Port-des-Fougères',
	'Parc-des-Ormes', 'Les-Terrasses', 'Colline-de-Verre', 'Le-Vieux-Moulin',
	'Rond-Point-des-Lilas', 'La-Haute-Prairie', 'Val-des-Cèdres',
	'Les-Arcades', 'Promenade-des-Saules'
] as const;

function mix32(value: number): number {
	let x = value >>> 0;
	x ^= x >>> 16;
	x = Math.imul(x, 0x7feb352d);
	x ^= x >>> 15;
	x = Math.imul(x, 0x846ca68b);
	x ^= x >>> 16;
	return x >>> 0;
}

function station(id: number): string {
	const h = mix32(id + 0x293ea7);
	return 'Gare de ' + locality[h % locality.length] + ' — ' +
		landmarks[(h >>> 8) % landmarks.length];
}

export function linkedPages(id: number): number[] {
	const choices = [
		(id + 1) % PAGE_COUNT,
		(id + PAGE_COUNT - 1) % PAGE_COUNT,
		mix32(id ^ 0x8142aa12) % PAGE_COUNT,
		mix32(id ^ 0xb196d37c) % PAGE_COUNT,
		mix32(id ^ 0x7fae52c0) % PAGE_COUNT,
		mix32(id ^ 0x41c64e6d) % PAGE_COUNT,
		mix32(id ^ 0x9e3779b9) % PAGE_COUNT,
		mix32(id ^ 0x6a09e667) % PAGE_COUNT
	];
	return [...new Set(choices)].filter((next) => next !== id);
}

export function renderHoneypotPage(id: number): string {
	if (!Number.isInteger(id) || id < 0 || id >= PAGE_COUNT) {
		throw new RangeError('Invalid decoy page');
	}
	const title = station(id);
	const rows = Array.from({ length: 12 }, (_, index) => {
		const h = mix32(id ^ Math.imul(index + 1, 0x9e3779b1));
		const mode = ['R', 'M', 'T', 'S'][h % 4];
		const route = mode + String(1 + ((h >>> 5) % 39));
		const destination = station((id + (h % 4096) + 1) % PAGE_COUNT);
		const minutes = ((h >>> 13) % 24) * 60 + ((h >>> 22) % 60);
		const clock = String(Math.floor(minutes / 60)).padStart(2, '0') + ':' +
			String(minutes % 60).padStart(2, '0');
		const platform = 1 + ((h >>> 9) % 9);
		return '<tr><td>' + clock + '</td><td>' + route + '</td><td>' +
			destination + '</td><td>Voie ' + platform + '</td></tr>';
	}).join('');

	const links = linkedPages(id).map((next) =>
		'<li><a href="' + HONEYPOT_PREFIX + '/chart/' + next + '">' +
		station(next) + ' — fiche ' + next + '</a></li>'
	).join('');
	return '<!doctype html>\n' +
		'<html lang="fr"><head><meta charset="utf-8">' +
		'<meta name="viewport" content="width=device-width, initial-scale=1">' +
		'<meta name="robots" content="noindex, noarchive">' +
		'<title>' + title + ' | Registre ferroviaire</title>' +
		'<style>body{font:16px system-ui,sans-serif;line-height:1.5;max-width:58rem;margin:2rem auto;padding:0 1rem;color:#252525}' +
		'table{width:100%;border-collapse:collapse}th,td{padding:.45rem;text-align:left;border-bottom:1px solid #ddd}' +
		'a{color:#234c71}nav ul{columns:2}footer{margin-top:2rem;font-size:.8rem;color:#555}</style></head>' +
		'<body><header><p>Registre régional des transports — catalogue historique</p>' +
		'<h1>' + title + '</h1><p>Fiche de gare ' + id + ' · correspondances et services</p></header>' +
		'<main><h2>Table des circulations</h2><table><thead><tr><th>Heure</th>' +
		'<th>Ligne</th><th>Destination</th><th>Voie</th></tr></thead><tbody>' + rows +
		'</tbody></table><nav aria-label="Gares voisines"><h2>Gares reliées et correspondances</h2>' +
		'<ul>' + links + '</ul></nav></main>' +
		'<footer>Répertoire synthétique pour essais techniques. Les gares, ' +
		'lignes et horaires présentés ne correspondent pas à des services réels.</footer>' +
		'</body></html>';
}

export function honeypotResponse(id: number): Response {
	return new Response(renderHoneypotPage(id), {
		status: 200,
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'public, max-age=300, s-maxage=86400',
			'X-Robots-Tag': 'noindex, noarchive',
			'X-Synthetic-Transit-Data': 'true',
			'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
		}
	});
}
