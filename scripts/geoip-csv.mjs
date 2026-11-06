/** Streaming RFC 4180 fields, including escaped quotes and multiline values. */
export async function* csvRows(chunks) {
	let row = [],
		field = '',
		quoted = false,
		afterQuote = false,
		skipLf = false;
	for await (const chunk of chunks) {
		for (const char of chunk) {
			if (skipLf) {
				skipLf = false;
				if (char === '\n') continue;
			}
			if (quoted) {
				if (char === '"') {
					quoted = false;
					afterQuote = true;
				} else field += char;
			} else if (afterQuote && char === '"') {
				field += '"';
				quoted = true;
				afterQuote = false;
			} else if (char === ',') {
				row.push(field);
				field = '';
				afterQuote = false;
			} else if (char === '\n' || char === '\r') {
				row.push(field);
				yield row;
				row = [];
				field = '';
				afterQuote = false;
				skipLf = char === '\r';
			} else if (char === '"' && field === '' && !afterQuote) {
				quoted = true;
			} else {
				if (afterQuote || char === '"') throw new Error('Malformed CSV quoting');
				field += char;
			}
			if (field.length > 65536) throw new Error('Oversized GeoIP CSV field');
		}
	}
	if (quoted) throw new Error('Unterminated CSV quote');
	if (field || row.length || afterQuote) yield [...row, field];
}
