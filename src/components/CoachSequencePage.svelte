<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type {
		SbbFormation,
		SbbFormationData,
		SbbFormationVehicle,
		SbbFormationVehicleAtScheduledStop,
		SbbStopPoint
	} from './sbbFormationTypes';
	export let coach_sequence: any;
	export let sbb_formation: SbbFormationData | null = null;
	export let close_coach_page: () => void;

	// Icons mapping for amenities and design
	const getIcon = (type: string): string => {
		const icons: Record<string, string> = {
			AIR_CONDITION: 'fa-snowflake',
			WHEELCHAIR_SPACE: 'fa-wheelchair',
			BIKE_SPACE: 'fa-bicycle',
			QUIET_ZONE: 'fa-volume-mute',
			FAMILY_ZONE: 'fa-child',
			INFO_POINT: 'fa-info-circle',
			DINING_CAR: 'fa-utensils',
			TOILET: 'fa-restroom',
			LOW_FLOOR: 'fa-wheelchair-alt' // NF
		};
		return icons[type] || 'fa-star';
	};

	const getLegendText = (type: string): string => {
		const texts: Record<string, string> = {
			AIR_CONDITION: $_('cs_air_condition', { default: 'Air conditioning' }),
			WHEELCHAIR_SPACE: $_('cs_wheelchair_space', {
				default: 'Wheelchair space with wheelchair-accessible toilet'
			}),
			BIKE_SPACE: $_('cs_bike_space', { default: 'Bicycle loading' }),
			QUIET_ZONE: $_('cs_quiet_zone', { default: 'Quiet zone in 1st class' }),
			FAMILY_ZONE: $_('cs_family_zone', { default: 'Family zone' }),
			INFO_POINT: $_('cs_info_point', { default: 'Information' }),
			DINING_CAR: $_('cs_dining_car', { default: 'Restaurant / Catering' }),
			TOILET: $_('cs_toilet', { default: 'Toilet' }),
			LOW_FLOOR: $_('cs_low_floor', { default: 'Low-floor access' }),
			occupancy_low: $_('cs_occupancy_low', { default: 'Low to average occupancy expected' }),
			occupancy_high: $_('cs_occupancy_high', { default: 'High occupancy expected' }),
			occupancy_very_high: $_('cs_occupancy_very_high', {
				default: 'Very high occupancy expected'
			}),
			class_1: $_('cs_class_1', { default: '1st class coach' }),
			class_2: $_('cs_class_2', { default: '2nd class coach' })
		};
		return object_has_key(texts, type) ? texts[type] : formatEnum(type);
	};

	function object_has_key(obj: any, key: any): boolean {
		return Object.prototype.hasOwnProperty.call(obj, key);
	}

	const formatEnum = (str: string): string => {
		if (!str) return '';
		return str
			.split('_')
			.map((word) => word.charAt(0) + word.slice(1).toLowerCase())
			.join(' ');
	};

	// Extract unique items for the legend
	let presentAmenities = new Set<string>();
	let presentClasses = new Set<string>();
	let presentOccupancies = new Set<string>();

	$: if (coach_sequence && coach_sequence.groups) {
		presentAmenities.clear();
		presentClasses.clear();
		presentOccupancies.clear();

		coach_sequence.groups.forEach((group: any) => {
			group.vehicles?.forEach((vehicle: any) => {
				if (vehicle.passenger_class) {
					presentClasses.add(vehicle.passenger_class);
				}
				if (vehicle.occupancy) {
					presentOccupancies.add(vehicle.occupancy);
				}
				vehicle.facilities?.forEach((facility: any) => {
					if (facility.amenity_type) {
						presentAmenities.add(facility.amenity_type);
					}
				});
			});
		});

		// Trigger reactivity
		presentAmenities = presentAmenities;
		presentClasses = presentClasses;
		presentOccupancies = presentOccupancies;
	}

	const SBB_VEHICLE_GAP = 6;
	const SBB_NO_PASSAGE_GAP = 22;

	type SbbStationOption = {
		key: string;
		name: string;
		uic: number | null;
		track: string | null;
		stopTime: { arrivalTime?: string | null; departureTime?: string | null } | null;
		destination: string | null;
		formationShortString: string | null;
	};

	type SbbVehicleView = {
		vehicle: SbbFormationVehicle;
		stationData: SbbFormationVehicleAtScheduledStop | null;
		width: number;
		start: number;
		end: number;
		gapAfter: number;
	};

	type SbbSectorSegment = {
		label: string;
		left: number;
		width: number;
		compact: boolean;
	};

	type SbbAmenity = {
		key: string;
		icon: string;
		label: string;
		shortLabel: string;
	};

	const sbbAmenityCatalog: Record<
		string,
		{ icon: string; translationKey: string; defaultText: string; shortLabel: string }
	> = {
		wheelchair: {
			icon: '/icons/sbb/wheelchair.svg',
			translationKey: 'cs_wheelchair_space',
			defaultText: 'Wheelchair space',
			shortLabel: '♿'
		},
		wheelchair_toilet: {
			icon: '/icons/sbb/wheelchair.svg',
			translationKey: 'cs_wheelchair_toilet',
			defaultText: 'Wheelchair space with wheelchair-accessible toilet',
			shortLabel: '♿ WC'
		},
		bicycle: {
			icon: '/icons/sbb/bicycle.svg',
			translationKey: 'cs_bike_space',
			defaultText: 'Bicycle space',
			shortLabel: 'Bike'
		},
		business_zone: {
			icon: '/icons/sbb/laptop.svg',
			translationKey: 'cs_business_zone',
			defaultText: 'Business zone in 1st class',
			shortLabel: 'Business'
		},
		family_zone: {
			icon: '/icons/sbb/family-zone.svg',
			translationKey: 'cs_family_zone',
			defaultText: 'Family coach with play area',
			shortLabel: 'Family'
		},
		stroller: {
			icon: '/icons/sbb/stroller.svg',
			translationKey: 'cs_stroller_space',
			defaultText: 'Stroller space',
			shortLabel: 'Stroller'
		},
		restaurant: {
			icon: '/icons/sbb/restaurant.svg',
			translationKey: 'cs_dining_car',
			defaultText: 'Restaurant / Catering',
			shortLabel: 'Restaurant'
		},
		low_floor: {
			icon: '/icons/sbb/niederflureinstieg.svg',
			translationKey: 'cs_low_floor',
			defaultText: 'Low-floor access',
			shortLabel: 'NF'
		},
		/*air_condition: {
			icon: '/icons/air-conditioner.svg',
			translationKey: 'cs_air_condition',
			defaultText: 'Air conditioning',
			shortLabel: 'A/C'
		},*/
		sleeping: {
			icon: '/icons/sbb/sleeping-car.svg',
			translationKey: 'cs_sleeping_car',
			defaultText: 'Sleeping car',
			shortLabel: 'Bed'
		},
		emergency_call: {
			icon: '/icons/sbb/emergency-call.svg',
			translationKey: 'cs_emergency_call',
			defaultText: 'Emergency call system',
			shortLabel: 'SOS'
		},
		closed: {
			icon: '/icons/sbb/closed.svg',
			translationKey: 'cs_closed_coach',
			defaultText: 'Coach closed',
			shortLabel: 'Closed'
		}
	};

	function stopPointMatches(a: SbbStopPoint | null | undefined, b: SbbStopPoint | null | undefined) {
		if (!a || !b) return false;
		if (a.uic != null && b.uic != null) return a.uic === b.uic;
		return Boolean(a.name && b.name && a.name === b.name);
	}

	function makeSbbStationKey(
		stopPoint: SbbStopPoint,
		stopTime: { arrivalTime?: string | null; departureTime?: string | null } | null | undefined,
		fallbackIndex: number
	) {
		const stopKey = stopPoint.uic ?? stopPoint.name ?? fallbackIndex;
		const timeKey = stopTime?.departureTime ?? stopTime?.arrivalTime ?? fallbackIndex;
		return `${stopKey}|${timeKey}`;
	}

	function getSbbStations(data: SbbFormationData | null): SbbStationOption[] {
		if (!data) return [];

		const stations: SbbStationOption[] = [];
		const seen = new Set<string>();

		(data.formationsAtScheduledStops ?? []).forEach((entry, index) => {
			const scheduledStop = entry.scheduledStop;
			const stopPoint = scheduledStop?.stopPoint;
			if (!stopPoint?.name) return;

			const hasVehicleData = (data.formations ?? []).some((formation) =>
				(formation.formationVehicles ?? []).some((vehicle) =>
					(vehicle.formationVehicleAtScheduledStops ?? []).some((vehicleStop) =>
						stopPointMatches(vehicleStop.stopPoint, stopPoint)
					)
				)
			);
			if (!hasVehicleData) return;

			const key = makeSbbStationKey(stopPoint, scheduledStop?.stopTime, index);
			if (seen.has(key)) return;
			seen.add(key);

			stations.push({
				key,
				name: stopPoint.name,
				uic: stopPoint.uic ?? null,
				track: scheduledStop?.track ?? null,
				stopTime: scheduledStop?.stopTime ?? null,
				destination:
					entry.formationShort?.vehicleGoals?.[0]?.destinationStopPoint?.name ?? null,
				formationShortString: entry.formationShort?.formationShortString ?? null
			});
		});

		if (stations.length > 0) return stations;

		const fallbackVehicle = data.formations
			?.flatMap((formation) => formation.formationVehicles ?? [])
			.find((vehicle) => (vehicle.formationVehicleAtScheduledStops?.length ?? 0) > 0);

		(fallbackVehicle?.formationVehicleAtScheduledStops ?? []).forEach((entry, index) => {
			if (!entry.stopPoint?.name) return;
			const key = makeSbbStationKey(entry.stopPoint, entry.stopTime, index);
			if (seen.has(key)) return;
			seen.add(key);
			stations.push({
				key,
				name: entry.stopPoint.name,
				uic: entry.stopPoint.uic ?? null,
				track: entry.track ?? null,
				stopTime: entry.stopTime ?? null,
				destination: null,
				formationShortString: null
			});
		});

		return stations;
	}

	function stationAsStopPoint(station: SbbStationOption | null): SbbStopPoint | null {
		if (!station) return null;
		return { name: station.name, uic: station.uic };
	}

	function findSbbVehicleStop(
		vehicle: SbbFormationVehicle,
		station: SbbStationOption | null
	): SbbFormationVehicleAtScheduledStop | null {
		if (!station) return null;
		const stationPoint = stationAsStopPoint(station);
		const matches = (vehicle.formationVehicleAtScheduledStops ?? []).filter((entry) =>
			stopPointMatches(entry.stopPoint, stationPoint)
		);
		if (matches.length <= 1) return matches[0] ?? null;

		return (
			matches.find(
				(entry) =>
					entry.stopTime?.departureTime === station.stopTime?.departureTime &&
					entry.stopTime?.arrivalTime === station.stopTime?.arrivalTime
			) ?? matches[0]
		);
	}

	function getFormationEndpoints(formation: SbbFormation) {
		const properties = (formation.formationVehicles ?? []).find(
			(vehicle) => vehicle.vehicleProperties?.fromStop || vehicle.vehicleProperties?.toStop
		)?.vehicleProperties;
		return {
			fromStop: properties?.fromStop ?? null,
			toStop: properties?.toStop ?? null
		};
	}

	function findStationIndex(stations: SbbStationOption[], stopPoint: SbbStopPoint | null | undefined) {
		return stations.findIndex((station) =>
			stopPointMatches(stationAsStopPoint(station), stopPoint)
		);
	}

	function selectSbbFormation(
		data: SbbFormationData | null,
		station: SbbStationOption | null,
		stations: SbbStationOption[]
	): SbbFormation | null {
		if (!data || !station) return null;
		const selectedIndex = stations.findIndex((candidate) => candidate.key === station.key);
		let bestFormation: SbbFormation | null = null;
		let bestScore = Number.NEGATIVE_INFINITY;

		for (const formation of data.formations ?? []) {
			const vehicles = formation.formationVehicles ?? [];
			if (!vehicles.some((vehicle) => findSbbVehicleStop(vehicle, station))) continue;

			const { fromStop, toStop } = getFormationEndpoints(formation);
			const fromIndex = findStationIndex(stations, fromStop);
			const toIndex = findStationIndex(stations, toStop);
			const low = Math.min(fromIndex, toIndex);
			const high = Math.max(fromIndex, toIndex);
			const inRange = fromIndex >= 0 && toIndex >= 0 && selectedIndex >= low && selectedIndex <= high;

			let score = inRange ? 1000 : 0;
			if (stopPointMatches(fromStop, stationAsStopPoint(station))) score += 100;
			if (stopPointMatches(toStop, stationAsStopPoint(station))) score += 10;
			if (inRange) score -= high - low;

			if (score > bestScore) {
				bestScore = score;
				bestFormation = formation;
			}
		}

		return bestFormation ?? data.formations?.[0] ?? null;
	}

	function clamp(value: number, min: number, max: number) {
		return Math.max(min, Math.min(max, value));
	}

	function buildSbbVehicleViews(
		formation: SbbFormation | null,
		station: SbbStationOption | null
	): SbbVehicleView[] {
		if (!formation || !station) return [];
		const vehicles = [...(formation.formationVehicles ?? [])].sort(
			(a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER)
		);
		const stationData = vehicles.map((vehicle) => findSbbVehicleStop(vehicle, station));
		let cursor = 0;

		return vehicles.map((vehicle, index) => {
			const width = clamp((vehicle.vehicleProperties?.length ?? 24) * 3, 58, 94);
			const hasNextVehicle = index < vehicles.length - 1;
			const gapAfter = hasNextVehicle
				? stationData[index + 1]?.accessToPreviousVehicle === false
					? SBB_NO_PASSAGE_GAP
					: SBB_VEHICLE_GAP
				: 0;
			const view = {
				vehicle,
				stationData: stationData[index],
				width,
				start: cursor,
				end: cursor + width,
				gapAfter
			};
			cursor = view.end + gapAfter;
			return view;
		});
	}

	function parseSectors(sectors: string | null | undefined) {
		return (sectors ?? '')
			.split(',')
			.map((sector) => sector.trim())
			.filter(Boolean);
	}

	function buildSbbSectorSegments(
		vehicles: SbbVehicleView[],
		totalWidth: number
	): SbbSectorSegment[] {
		const sectorRanges = new Map<string, { start: number; end: number }>();

		for (const view of vehicles) {
			const sectors = parseSectors(view.stationData?.sectors);
			if (sectors.length === 0) continue;

			sectors.forEach((sector, index) => {
				const start = view.start + (view.width * index) / sectors.length;
				const end = view.start + (view.width * (index + 1)) / sectors.length;
				const current = sectorRanges.get(sector);
				sectorRanges.set(sector, {
					start: Math.min(current?.start ?? start, start),
					end: Math.max(current?.end ?? end, end)
				});
			});
		}

		const ordered = Array.from(sectorRanges.entries())
			.map(([label, range]) => ({ label, ...range }))
			.sort((a, b) => a.start - b.start || a.end - b.end);

		return ordered.map((sector, index) => {
			const previous = ordered[index - 1];
			const next = ordered[index + 1];
			const left = index === 0 ? 0 : clamp((previous.end + sector.start) / 2, 0, totalWidth);
			const right =
				index === ordered.length - 1
					? totalWidth
					: clamp((sector.end + next.start) / 2, left, totalWidth);
			const width = Math.max(0, right - left);
			return { label: sector.label, left, width, compact: width < 104 };
		});
	}

	function getSbbVehicleClass(vehicle: SbbFormationVehicle) {
		const firstClass = vehicle.vehicleProperties?.number1class ?? 0;
		const secondClass = vehicle.vehicleProperties?.number2class ?? 0;
		if (firstClass > 0 && secondClass > 0) return '1 / 2';
		if (firstClass > 0) return '1';
		if (secondClass > 0) return '2';
		return '';
	}

	function getSbbVehicleLabel(vehicle: SbbFormationVehicle, fallbackIndex: number) {
		if (vehicle.number != null && vehicle.number > 0) return String(vehicle.number);
		if (vehicle.position != null && vehicle.position > 0) return String(vehicle.position);
		return String(fallbackIndex + 1);
	}

	function getSbbVehicleTypeCode(vehicle: SbbFormationVehicle) {
		const identifier = vehicle.vehicleIdentifier;
		if (identifier?.typeCode != null) return String(identifier.typeCode);
		return identifier?.typeCodeName?.trim() ?? '';
	}

	function getSbbFormationShortAmenityKeys(
		station: SbbStationOption | null,
		vehicle: SbbFormationVehicle
	) {
		const keys = new Set<string>();
		const short = station?.formationShortString;
		if (!short || vehicle.number == null) return keys;

		const vehicleNumber = String(vehicle.number).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const classAndFeatures = short.match(
			new RegExp(`:${vehicleNumber}(?:#([^,@)\\]]+))?`)
		);
		const featureCodes = new Set(
			(classAndFeatures?.[1] ?? '')
				.split(';')
				.map((code) => code.trim().toUpperCase())
				.filter(Boolean)
		);

		if (featureCodes.has('NF')) keys.add('low_floor');
		if (featureCodes.has('BZ')) keys.add('business_zone');
		if (new RegExp(`%W[12]:${vehicleNumber}(?:#|[,)\\]])`).test(short)) keys.add('restaurant');

		return keys;
	}

	function getSbbVehicleAmenityKeys(
		vehicle: SbbFormationVehicle,
		station: SbbStationOption | null = null
	) {
		const keys = getSbbFormationShortAmenityKeys(station, vehicle);
		const properties = vehicle.vehicleProperties;
		const accessibility = properties?.accessibilityProperties;
		const pictos = properties?.pictoProperties;

		if (
			accessibility?.disabledCompartment ||
			(accessibility?.numberWheelchairSpaces ?? 0) > 0 ||
			(accessibility?.numberWheelchairSpaces1class ?? 0) > 0 ||
			(accessibility?.numberWheelchairSpaces2class ?? 0) > 0 ||
			pictos?.wheelchairPicto
		) {
			keys.add('wheelchair');
		}
		if (accessibility?.wheelchairToilet) keys.add('wheelchair_toilet');
		if (properties?.bikePlatform || (properties?.numberBikeHooks ?? 0) > 0 || pictos?.bikePicto) {
			keys.add('bicycle');
		}
		if (pictos?.businessZonePicto) keys.add('business_zone');
		if (pictos?.familyZonePicto || /fam/i.test(vehicle.vehicleIdentifier?.typeCodeName ?? '')) {
			keys.add('family_zone');
		}
		if (pictos?.strollerPicto) keys.add('stroller');
		if (
			(properties?.trolleyStatus && properties.trolleyStatus !== 'Normal') ||
			(properties?.numberRestaurantSpace ?? 0) > 0 ||
			accessibility?.wheelchairAccessibleRestaurant
		) {
			keys.add('restaurant');
		}
		if (properties?.lowFloorTrolley) keys.add('low_floor');
		if (properties?.climated) keys.add('air_condition');
		if ((properties?.numberBeds ?? 0) > 0) keys.add('sleeping');
		if (properties?.emergencyCallSystem) keys.add('emergency_call');
		if (properties?.closed) keys.add('closed');

		return Array.from(keys);
	}

	function getSbbAmenity(key: string): SbbAmenity | null {
		const definition = sbbAmenityCatalog[key];
		if (!definition) return null;
		return {
			key,
			icon: definition.icon,
			label: $_(definition.translationKey, { default: definition.defaultText }),
			shortLabel: definition.shortLabel
		};
	}

	function getSbbVehicleAmenities(
		vehicle: SbbFormationVehicle,
		station: SbbStationOption | null
	) {
		return getSbbVehicleAmenityKeys(vehicle, station)
			.map(getSbbAmenity)
			.filter((amenity): amenity is SbbAmenity => amenity !== null);
	}

	function collectSbbLegendItems(
		vehicles: SbbVehicleView[],
		station: SbbStationOption | null
	) {
		const keys = new Set<string>();
		vehicles.forEach((view) =>
			getSbbVehicleAmenityKeys(view.vehicle, station).forEach((key) => keys.add(key))
		);
		return Array.from(keys)
			.map(getSbbAmenity)
			.filter((amenity): amenity is SbbAmenity => amenity !== null);
	}

	function collectSbbClasses(vehicles: SbbVehicleView[]) {
		const classes = new Set<string>();
		for (const view of vehicles) {
			const properties = view.vehicle.vehicleProperties;
			if ((properties?.number1class ?? 0) > 0) classes.add('1');
			if ((properties?.number2class ?? 0) > 0) classes.add('2');
		}
		return classes;
	}

	let selectedSbbStationKey = '';
	let sbbStations: SbbStationOption[] = [];
	let selectedSbbStation: SbbStationOption | null = null;
	let activeSbbFormation: SbbFormation | null = null;
	let sbbVehicleViews: SbbVehicleView[] = [];
	let sbbTrainWidth = 0;
	let sbbSectorSegments: SbbSectorSegment[] = [];
	let sbbLegendItems: SbbAmenity[] = [];
	let sbbClasses = new Set<string>();
	let sbbDirection = '';
	let showSbbVehicleNumber = false;

	$: sbbStations = getSbbStations(sbb_formation);
	$: if (
		sbbStations.length > 0 &&
		!sbbStations.some((station) => station.key === selectedSbbStationKey)
	) {
		selectedSbbStationKey = sbbStations[0].key;
	}
	$: selectedSbbStation =
		sbbStations.find((station) => station.key === selectedSbbStationKey) ?? null;
	$: activeSbbFormation = selectSbbFormation(sbb_formation, selectedSbbStation, sbbStations);
	$: sbbVehicleViews = buildSbbVehicleViews(activeSbbFormation, selectedSbbStation);
	$: sbbTrainWidth = sbbVehicleViews[sbbVehicleViews.length - 1]?.end ?? 0;
	$: sbbSectorSegments = buildSbbSectorSegments(sbbVehicleViews, sbbTrainWidth);
	$: sbbLegendItems = collectSbbLegendItems(sbbVehicleViews, selectedSbbStation);
	$: sbbClasses = collectSbbClasses(sbbVehicleViews);
	$: sbbDirection =
		selectedSbbStation?.destination ??
		(sbbStations[sbbStations.length - 1]?.key !== selectedSbbStationKey
			? sbbStations[sbbStations.length - 1]?.name ?? ''
			: '');
</script>

<!-- Add FontAwesome to the head -->
<svelte:head>
	<link
		rel="stylesheet"
		href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
	/>
</svelte:head>

<div class="flex flex-col text-current w-full h-full pb-8">
	<div class="flex-1 mt-4">
		{#if sbb_formation && (sbb_formation.formations?.length ?? 0) > 0}
			<section class="w-full">
				<h2 class="mb-4 px-4 text-lg font-bold">
					{$_('cs_train_formation', { default: 'Train formation' })}
				</h2>
				{#if sbbStations.length > 0}
					<div
						class="hide-scrollbar flex w-full gap-2 overflow-x-auto px-4 pb-4"
						role="tablist"
						aria-label={$_('cs_station_formation', { default: 'Formation at station' })}
					>
						{#each sbbStations as station}
							<button
								type="button"
								role="tab"
								aria-selected={station.key === selectedSbbStationKey}
								class="shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors {station.key ===
								selectedSbbStationKey
									? 'border-gray-500 bg-white text-black shadow-sm dark:border-gray-400 dark:bg-gray-700 dark:text-white'
									: 'border-transparent bg-gray-200 text-gray-600 hover:border-gray-400 dark:bg-gray-800 dark:text-gray-300'}"
								on:click={() => {
									selectedSbbStationKey = station.key;
								}}
							>
								{station.name}
							</button>
						{/each}
					</div>
				{/if}

				{#if selectedSbbStation && sbbVehicleViews.length > 0}
					<div
						class="w-full border-y border-gray-200 bg-gray-50 py-4 dark:border-gray-800 dark:bg-[#1a1c1e]"
					>
						<div class="mb-3 flex items-center gap-2 px-4 text-sm text-gray-700 dark:text-gray-300">
							<span aria-hidden="true">‹</span>
							<span>
								{$_('cs_direction_of_travel', { default: 'Direction of travel' })}
								{sbbDirection}
							</span>
							{#if selectedSbbStation.track}
								<span class="ml-auto whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
									{$_('platform', { default: 'Platform' })} {selectedSbbStation.track}
								</span>
							{/if}
						</div>

						<div
							class="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 text-xs text-gray-600 dark:text-gray-400"
						>
							<div class="flex flex-1 flex-wrap gap-x-4 gap-y-1">
								{#if activeSbbFormation?.metaInformation?.length != null}
									<span>
										<span class="font-medium text-gray-700 dark:text-gray-300">
											{$_('cs_length', { default: 'Length' })}:
										</span>
										{activeSbbFormation.metaInformation.length} m
									</span>
								{/if}
								{#if activeSbbFormation?.metaInformation?.numberVehicles != null}
									<span>
										<span class="font-medium text-gray-700 dark:text-gray-300">
											{$_('cs_vehicles', { default: 'Vehicles' })}:
										</span>
										{activeSbbFormation.metaInformation.numberVehicles}
									</span>
								{/if}
								{#if activeSbbFormation?.metaInformation?.numberSeats != null}
									<span>
										<span class="font-medium text-gray-700 dark:text-gray-300">
											{$_('cs_seats', { default: 'Seats' })}:
										</span>
										{activeSbbFormation.metaInformation.numberSeats}
									</span>
								{/if}
								{#if activeSbbFormation?.metaInformation?.numberAxis != null}
									<span>
										<span class="font-medium text-gray-700 dark:text-gray-300">
											{$_('cs_axis', { default: 'Axis' })}:
										</span>
										{activeSbbFormation.metaInformation.numberAxis}
									</span>
								{/if}
							</div>
							<label class="ml-auto flex cursor-pointer items-center gap-2 whitespace-nowrap">
								<span>{$_('cs_show_vehicle_number', { default: 'Show vehicle number' })}</span>
								<input class="sr-only" type="checkbox" bind:checked={showSbbVehicleNumber} />
								<span
									aria-hidden="true"
									class="relative h-5 w-9 shrink-0 rounded-full transition-colors {showSbbVehicleNumber
										? 'bg-blue-600'
										: 'bg-gray-300 dark:bg-gray-600'}"
								>
									<span
										class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform {showSbbVehicleNumber
											? 'translate-x-[18px]'
											: 'translate-x-0.5'}"
									></span>
								</span>
							</label>
						</div>

						<div class="hide-scrollbar w-full overflow-x-auto px-4 pb-2">
							<div class="min-w-max" style={`width: ${sbbTrainWidth}px`}>
								<div class="relative mb-2 h-7 w-full">
									{#each sbbSectorSegments as sector}
										<div
											class="absolute top-0 flex h-7 items-center gap-1 overflow-hidden px-0.5 text-xs text-gray-600 dark:text-gray-300"
											style={`left: ${sector.left}px; width: ${sector.width}px;`}
										>
											<span class="h-px min-w-1 flex-1 bg-gray-400 dark:bg-gray-600"></span>
											<span class="shrink-0 whitespace-nowrap">
												{#if sector.compact}
													{$_('cs_sector_short', { default: 'Sec.' })} {sector.label}
												{:else}
													{$_('cs_sector', { default: 'Sector' })} {sector.label}
												{/if}
											</span>
											<span class="h-px min-w-1 flex-1 bg-gray-400 dark:bg-gray-600"></span>
										</div>
									{/each}
								</div>

								<div class="flex items-start">
									{#each sbbVehicleViews as view, i}
										{@const vehicleClass = getSbbVehicleClass(view.vehicle)}
										{@const amenities = getSbbVehicleAmenities(view.vehicle, selectedSbbStation)}
										{@const typeCode = getSbbVehicleTypeCode(view.vehicle)}
										{@const vehicleNumber = view.vehicle.vehicleIdentifier?.vehicleNumber}
										<div
											class="flex shrink-0 flex-col items-center"
											style={`width: ${view.width}px`}
											title={view.vehicle.vehicleIdentifier?.evn ??
												view.vehicle.vehicleIdentifier?.typeCodeName ??
												typeCode}
										>
											<span class="mb-1 h-4 text-xs font-medium">
												{getSbbVehicleLabel(view.vehicle, i)}
											</span>
											<div
												class="relative flex h-10 w-full items-center rounded-xl border-[1.5px] border-current px-3 font-bold"
											>
												{#if vehicleClass}
													<span class="ml-auto text-sm">{vehicleClass}</span>
												{/if}
												{#if view.vehicle.vehicleProperties?.closed}
													<img
														src="/icons/sbb/closed.svg"
														alt={$_('cs_closed_coach', { default: 'Coach closed' })}
														class="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2"
													/>
												{/if}
											</div>
											<div class="mt-2 flex min-h-5 max-w-full items-center justify-center gap-1">
												{#each amenities as amenity}
													<img
														src={amenity.icon}
														alt={amenity.shortLabel}
														title={amenity.label}
														class="h-4 w-4 object-contain dark:invert"
													/>
												{/each}
											</div>
											<div class="mt-1 min-h-4 max-w-full px-1 text-center text-[10px] leading-4 text-gray-500 dark:text-gray-400">
												{#if typeCode}
													<span
														class="block max-w-full truncate"
														title={view.vehicle.vehicleIdentifier?.typeCodeName ?? typeCode}
														>{typeCode}</span
													>
												{/if}
											</div>
											{#if showSbbVehicleNumber}
												<div
													class="min-h-4 max-w-full truncate px-1 text-center text-[10px] leading-4 text-gray-500 dark:text-gray-400"
													title={vehicleNumber ?? ''}
												>
													{vehicleNumber ?? '—'}
												</div>
											{/if}
										</div>
										{#if view.gapAfter > 0}
											<div
												class="mt-8 flex h-4 shrink-0 items-center justify-center"
												style={`width: ${view.gapAfter}px`}
											>
												{#if sbbVehicleViews[i + 1].stationData?.accessToPreviousVehicle === false}
													<span
														class="no-passage-icon"
														role="img"
														aria-label={$_('cs_no_passage', {
															default: 'No passage between coaches'
														})}
													></span>
												{/if}
											</div>
										{/if}
									{/each}
								</div>
							</div>
						</div>
					</div>

					<div class="px-4 mt-6">
						<h3 class="text-base font-bold mb-4">{$_('cs_legend', { default: 'Legend' })}</h3>
						<div class="space-y-3 text-sm">
							{#if sbbClasses.has('1')}
								<div class="flex items-center gap-3">
									<span
										class="w-5 rounded-sm border border-current py-[2px] text-center text-xs font-bold leading-none"
										>1</span
									>
									<span>{getLegendText('class_1')}</span>
								</div>
							{/if}
							{#if sbbClasses.has('2')}
								<div class="flex items-center gap-3">
									<span
										class="w-5 rounded-sm border border-current py-[2px] text-center text-xs font-bold leading-none"
										>2</span
									>
									<span>{getLegendText('class_2')}</span>
								</div>
							{/if}
							{#each sbbLegendItems as amenity}
								<div class="flex items-center gap-3">
									<img
										src={amenity.icon}
										alt={amenity.shortLabel}
										class="h-5 w-5 object-contain dark:invert"
									/>
									<span>{amenity.label}</span>
								</div>
							{/each}
						</div>
						<div class="mt-6 text-xs text-gray-500">
							{$_('cs_disclaimer', { default: 'All information without guarantee.' })}
						</div>
					</div>
				{:else}
					<div class="p-8 text-center text-gray-500">
						{$_('cs_no_data', { default: 'No train formation data available.' })}
					</div>
				{/if}
			</section>
		{:else if coach_sequence && coach_sequence.groups && coach_sequence.groups.length > 0}
			{@const group = coach_sequence.groups[0]}

			<!-- Horizontal Carriages Scroller Section -->
			<div
				class="bg-gray-100 dark:bg-[#1a1c1e] py-6 w-full max-w-full -mt-4 border-b border-gray-200 dark:border-gray-800"
			>
				<!--<div class="px-4 mb-4 flex items-center text-sm font-medium dark:text-gray-300">
          <i class="fas fa-chevron-left text-xs mr-2"></i>
          <span>Direction of travel {group.destination || "destination"}</span>
        </div>-->

				<div class="overflow-x-auto w-full flex items-end gap-1 px-4 pb-2">
					{#each group.vehicles as vehicle, i}
						<div class="flex-shrink-0 flex flex-col items-center">
							<span class="text-xs mb-1 font-medium">{vehicle.label || vehicle.order + 1}</span>
							<div
								class="w-16 h-10 border-[1.5px] border-current flex items-center justify-between px-2 font-bold
                {i === 0 ? 'train-nose-line' : 'rounded-lg'} 
                {i === group.vehicles.length - 1 ? 'train-tail-line' : 'rounded-lg'}"
							>
								<div class="text-[10px] flex gap-[2px]">
									{#if vehicle.occupancy === 'HIGH' || vehicle.occupancy === 'VERY_HIGH'}
										<i
											class="fas fa-user-friends {vehicle.occupancy === 'VERY_HIGH'
												? 'text-red-500'
												: ''}"
										></i>
									{:else if vehicle.occupancy}
										<i class="fas fa-user"></i>
									{/if}
								</div>
								<span class="text-sm">
									{#if vehicle.passenger_class === 'FIRST'}
										<span>1</span>
									{/if}
									{#if vehicle.passenger_class === 'SECOND'}
										<span>2</span>
									{/if}
								</span>
							</div>
							<!-- Amenities below carriage -->
							<div class="mt-2 text-xs flex gap-1 justify-center min-h-[16px]">
								{#if vehicle.facilities}
									{#each vehicle.facilities as amenity}
										{#if amenity.amenity_type === 'LOW_FLOOR'}
											<span class="font-bold text-[10px]">{$_('cs_nf', { default: 'NF' })}</span>
										{:else}
											<i class="fas {getIcon(amenity.amenity_type)}"></i>
										{/if}
									{/each}
								{/if}
							</div>
						</div>
						{#if i < group.vehicles.length - 1}
							<div class="w-2 h-[2px] bg-current mb-8"></div>
						{/if}
					{/each}
				</div>
			</div>

			<!-- LEGEND -->
			<div class="px-4 mt-6">
				<h3 class="text-base font-bold mb-4">{$_('cs_legend', { default: 'Legend' })}</h3>
				<div class="space-y-3 text-sm">
					{#if presentOccupancies.size > 0}
						<div class="flex items-center gap-3">
							<i class="fas fa-user w-5 text-center"></i>
							<span>{getLegendText('occupancy_low')}</span>
						</div>
						<div class="flex items-center gap-3">
							<i class="fas fa-user-friends w-5 text-center"></i>
							<span>{getLegendText('occupancy_high')}</span>
						</div>
						<div class="flex items-center gap-3">
							<i class="fas fa-users w-5 text-center text-red-500"></i>
							<span>{getLegendText('occupancy_very_high')}</span>
						</div>
					{/if}

					{#if presentClasses.has('FIRST')}
						<div class="flex items-center gap-3">
							<span
								class="w-5 text-center font-bold border border-current text-xs leading-none py-[2px] rounded-sm"
								>1</span
							>
							<span>{getLegendText('class_1')}</span>
						</div>
					{/if}
					{#if presentClasses.has('SECOND')}
						<div class="flex items-center gap-3">
							<span
								class="w-5 text-center font-bold border border-current text-xs leading-none py-[2px] rounded-sm"
								>2</span
							>
							<span>{getLegendText('class_2')}</span>
						</div>
					{/if}

					<!-- Used Amenities -->
					{#each Array.from(presentAmenities) as amenityType}
						<div class="flex items-center gap-3">
							{#if amenityType === 'LOW_FLOOR'}
								<span class="w-5 text-center font-bold text-xs italic"
									>{$_('cs_nf', { default: 'NF' })}</span
								>
							{:else}
								<i class="fas {getIcon(amenityType)} w-5 text-center"></i>
							{/if}
							<span>{getLegendText(amenityType)}</span>
						</div>
					{/each}
				</div>
				<div class="mt-6 text-xs text-gray-500">
					{$_('cs_disclaimer', { default: 'All information without guarantee.' })}
				</div>
			</div>
		{:else}
			<div class="p-8 text-center text-gray-500">
				{$_('cs_no_data', { default: 'No train formation data available.' })}
			</div>
		{/if}
	</div>
</div>

<style>
	.hide-scrollbar::-webkit-scrollbar {
		display: none;
	}
	.hide-scrollbar {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}

	.no-passage-icon {
		position: relative;
		display: inline-block;
		width: 16px;
		height: 16px;
		flex: 0 0 16px;
		border-radius: 9999px;
		background: rgb(198, 0, 24);
	}

	.no-passage-icon::after {
		position: absolute;
		top: 50%;
		left: 4px;
		right: 4px;
		height: 2px;
		border-radius: 9999px;
		background: white;
		content: '';
		transform: translateY(-50%);
	}

	.train-nose-line {
		border-top-left-radius: 20px;
		border-bottom-left-radius: 20px;
		border-top-right-radius: 8px;
		border-bottom-right-radius: 8px;
	}

	.train-tail-line {
		border-top-right-radius: 20px;
		border-bottom-right-radius: 20px;
		border-top-left-radius: 8px;
		border-bottom-left-radius: 8px;
	}
</style>
