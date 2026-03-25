//Written by Samuel Sharp
//modified by Kyler Chin

export function has_schedule_pdf(chateau_id: string) {
	if (
		[
			'metrolinktrains',
			'san-diego-mts',
			'northcountytransitdistrict',
			'orangecountytransportationauthority',
			'metro~losangeles'
		].includes(chateau_id)
	) {
		return true;
	} else {
		return false;
	}
}

export function find_schedule_pdf_initial(chateau_id: string, route_id: string) {
	if (chateau_id == 'metrolinktrains') {
		return `https://metrolinktrains.com/globalassets/schedules/timetables/2026/metrolink-all-lines-timetable-03-2026-temp-schedule.pdf`;
	} else if (chateau_id == 'san-diego-mts') {
		return `https://www.sdmts.com/sites/default/files/routes/pdf/${route_id}.pdf`;
	} else if (chateau_id == 'northcountytransitdistrict') {
		return `https://gonctd.com/wp-content/uploads/transit/${route_id === '301' ? '101' : route_id}.pdf`;
	} else if (chateau_id === 'orangecountytransportationauthority') {
		return `https://octa.net/ebusbook/RoutePDF/route${route_id.padStart(3, '0')}.pdf`;
	} else if (chateau_id === 'metro~losangeles') {
		//move to backend later
		return `https://www.metro.net/riding/schedules-2/`;
	}
}

export function schedule_pdf_needs_hydration(chateau_id: string) {
	return chateau_id === 'metro~losangeles';
}

export async function find_schedule_pdf(chateau_id: string, route_id: string) {
	if (chateau_id === 'metro~losangeles') {
		const schedule_search = await (
			await fetch(
				`https://www.metro.net/wp-json/wp/v2/media?search=${route_id.split('-')[0].padStart(3, '0')}_tt&_fields=link`
			)
		).json();
		if (schedule_search.length > 0) {
			if (schedule_search[0].link.includes('line-override')) {
				if (schedule_search.length > 1) {
					return schedule_search[1].link;
				} else {
					return `https://www.metro.net/riding/schedules-2/`;
				}
			} else {
				return schedule_search[0].link;
			}
		} else {
			return `https://www.metro.net/riding/schedules-2/`;
		}
	} else {
		return null;
	}
}
