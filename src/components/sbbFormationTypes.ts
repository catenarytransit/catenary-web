export interface SbbFormationData {
	vehicleJourneyType?: string | null;
	formations?: SbbFormation[];
	formationsAtScheduledStops?: SbbFormationAtScheduledStop[];
	hints?: unknown[];
	journeyMetaInformation?: SbbJourneyMetaInformation | null;
	lastUpdate?: string | null;
	relationships?: unknown[];
	trainMetaInformation?: SbbTrainMetaInformation | null;
}

export interface SbbFormation {
	formationVehicles?: SbbFormationVehicle[];
	metaInformation?: SbbFormationMetaInformation | null;
}

export interface SbbFormationVehicle {
	formationVehicleAtScheduledStops?: SbbFormationVehicleAtScheduledStop[];
	number?: number | null;
	position?: number | null;
	vehicleIdentifier?: SbbVehicleIdentifier | null;
	vehicleProperties?: SbbVehicleProperties | null;
}

export interface SbbFormationVehicleAtScheduledStop {
	accessToPreviousVehicle?: boolean | null;
	sectors?: string | null;
	stopPoint?: SbbStopPoint | null;
	stopTime?: SbbStopTime | null;
	track?: string | null;
}

export interface SbbStopPoint {
	name?: string | null;
	uic?: number | null;
}

export interface SbbStopTime {
	arrivalTime?: string | null;
	departureTime?: string | null;
}

export interface SbbVehicleIdentifier {
	buildTypeCode?: string | null;
	checkNumber?: string | null;
	countryCode?: string | null;
	evn?: string | null;
	parentEvn?: string | null;
	typeCode?: number | null;
	typeCodeName?: string | null;
	vehicleNumber?: string | null;
}

export interface SbbVehicleProperties {
	accessibilityProperties?: SbbAccessibilityProperties | null;
	bikePlatform?: boolean | null;
	climated?: boolean | null;
	closed?: boolean | null;
	emergencyCallSystem?: boolean | null;
	fromStop?: SbbStopPoint | null;
	length?: number | null;
	lowFloorTrolley?: boolean | null;
	number1class?: number | null;
	number2class?: number | null;
	numberBeds?: number | null;
	numberBikeHooks?: number | null;
	numberRestaurantSpace?: number | null;
	pictoProperties?: SbbPictoProperties | null;
	toStop?: SbbStopPoint | null;
	trolleyStatus?: string | null;
	vehicleRelation?: SbbVehicleRelation | null;
	vehicleWillBePutAway?: boolean | null;
}

export interface SbbAccessibilityProperties {
	disabledCompartment?: boolean | null;
	numberWheelchairSpaces?: number | null;
	numberWheelchairSpaces1class?: number | null;
	numberWheelchairSpaces2class?: number | null;
	wheelchairAccessibleRestaurant?: boolean | null;
	wheelchairSymbolProperties?: SbbWheelchairSymbolProperties | null;
	wheelchairToilet?: boolean | null;
}

export interface SbbWheelchairSymbolProperties {
	foldingRamp?: boolean | null;
	gapBridging?: boolean | null;
	heightBoardingPlatform?: number | null;
}

export interface SbbPictoProperties {
	bikePicto?: boolean | null;
	businessZonePicto?: boolean | null;
	familyZonePicto?: boolean | null;
	strollerPicto?: boolean | null;
	wheelchairPicto?: boolean | null;
}

export interface SbbVehicleRelation {
	directTrolleys?: unknown[];
	nextVehicleJourney?: SbbVehicleJourneyInfo | null;
	previousVehicleJourney?: SbbVehicleJourneyInfo | null;
}

export interface SbbVehicleJourneyInfo {
	journeyMetaInformation?: SbbJourneyMetaInformation | null;
	trainMetaInformation?: SbbTrainMetaInformation | null;
}

export interface SbbJourneyMetaInformation {
	SJYID?: string | null;
	operationDate?: string | null;
}

export interface SbbTrainMetaInformation {
	trainNumber?: number | null;
	toCode?: string | null;
	runs?: string | null;
}

export interface SbbFormationMetaInformation {
	length?: number | null;
	numberAxis?: number | null;
	numberSeats?: number | null;
	numberVehicles?: number | null;
}

export interface SbbFormationAtScheduledStop {
	formationShort?: SbbFormationShort | null;
	scheduledStop?: SbbScheduledStop | null;
}

export interface SbbFormationShort {
	formationShortString?: string | null;
	vehicleGoals?: SbbVehicleGoal[];
}

export interface SbbVehicleGoal {
	destinationStopPoint?: SbbStopPoint | null;
	fromVehicleAtPosition?: number | null;
	toVehicleAtPosition?: number | null;
}

export interface SbbScheduledStop {
	stopModifications?: number | null;
	stopPoint?: SbbStopPoint | null;
	stopTime?: SbbStopTime | null;
	stopType?: string | null;
	track?: string | null;
}
