/** Phase 4's device-only, presentation-free Tessie statistics contract. */
export type TessieStatisticsRange = { startInclusive: string; endExclusive: string };
export type TessieStatisticsDrive = {
  journeyId: string; sourceDriveId: string | null; vehicleKey: string; vehicleName: string | null;
  startedAt: string; endedAt: string; miles: number; energyUsedKwh: number | null;
  startingLocation: string; endingLocation: string;
  startingBatteryPercent: number | null; endingBatteryPercent: number | null;
};
export type TessieStatisticsCharge = {
  id: string; journeyId: string; startedAt: string; endedAt: string; location: string;
  energyAddedKwh: number | null; arrivalBatteryPercent: number | null; departureBatteryPercent: number | null;
};
export type TessieJourneyEnergy = TessieStatisticsDrive & { whPerMile: number | null };
export type TessieRoadCharge = TessieStatisticsCharge & { durationMinutes: number; batteryGainedPercent: number | null };
export type TessieRouteComparison = {
  vehicleKey: string; startingLocation: string; endingLocation: string; journeys: number;
  journeyIds: string[]; totalMiles: number; measuredJourneys: number; measuredMiles: number; totalEnergyUsedKwh: number | null;
  averageWhPerMile: number | null; bestWhPerMile: number | null; worstWhPerMile: number | null;
};
export type TessieStatistics = {
  range: TessieStatisticsRange;
  // Null means no valid measurement; zero means a measured value of zero.
  drivingEfficiency: { journeys: number; measuredJourneys: number; measuredMiles: number; energyUsedKwh: number | null; whPerMile: number | null };
  energyByJourney: TessieJourneyEnergy[];
  chargingOnRoad: { sessions: number; measuredSessions: number; energyAddedKwh: number | null; durationMinutes: number; charges: TessieRoadCharge[] };
  repeatedRoutes: TessieRouteComparison[];
};

const validTime = (value: string) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const validAmount = (value: number | null): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const validBattery = (value: number | null) => value === null || (validAmount(value) && value <= 100);
const label = (value: string) => value.trim().replace(/\s+/g, ' ');

/** Uses UTC half-open intervals and each imported journey/charge identity once. */
export function buildTessieStatistics(
  range: TessieStatisticsRange,
  drives: TessieStatisticsDrive[],
  charges: TessieStatisticsCharge[],
): TessieStatistics {
  if (!validTime(range.startInclusive) || !validTime(range.endExclusive) || range.startInclusive >= range.endExclusive) {
    throw new Error('Invalid Tessie statistics date range.');
  }
  const validDrives = new Map<string, TessieStatisticsDrive>();
  for (const drive of drives) {
    if (!drive.journeyId || !drive.vehicleKey || !validTime(drive.startedAt) || !validTime(drive.endedAt)
      || drive.startedAt >= drive.endedAt || drive.startedAt < range.startInclusive || drive.startedAt >= range.endExclusive
      || !validAmount(drive.miles) || (drive.energyUsedKwh !== null && !validAmount(drive.energyUsedKwh))
      || !validBattery(drive.startingBatteryPercent) || !validBattery(drive.endingBatteryPercent)) continue;
    const identity = drive.sourceDriveId || drive.journeyId;
    const earlier = validDrives.get(identity);
    if (!earlier || Date.parse(drive.endedAt) - Date.parse(drive.startedAt) > Date.parse(earlier.endedAt) - Date.parse(earlier.startedAt)) {
      validDrives.set(identity, drive);
    }
  }
  const nonoverlapping: TessieStatisticsDrive[] = [];
  for (const drive of [...validDrives.values()].sort((a, b) => a.vehicleKey.localeCompare(b.vehicleKey) || a.startedAt.localeCompare(b.startedAt))) {
    const previous = nonoverlapping.at(-1);
    if (previous?.vehicleKey === drive.vehicleKey) {
      const overlap = Math.min(Date.parse(previous.endedAt), Date.parse(drive.endedAt))
        - Math.max(Date.parse(previous.startedAt), Date.parse(drive.startedAt));
      const shorter = Math.min(Date.parse(previous.endedAt) - Date.parse(previous.startedAt), Date.parse(drive.endedAt) - Date.parse(drive.startedAt));
      if (overlap > 0 && overlap / shorter >= 0.8) {
        if (Date.parse(drive.endedAt) - Date.parse(drive.startedAt) > Date.parse(previous.endedAt) - Date.parse(previous.startedAt)) {
          nonoverlapping[nonoverlapping.length - 1] = drive;
        }
        continue;
      }
    }
    nonoverlapping.push(drive);
  }
  const energyByJourney: TessieJourneyEnergy[] = nonoverlapping.map(drive => ({
    ...drive, whPerMile: drive.miles > 0 && drive.energyUsedKwh !== null ? drive.energyUsedKwh * 1_000 / drive.miles : null,
  })).sort((a, b) => b.startedAt.localeCompare(a.startedAt) || a.journeyId.localeCompare(b.journeyId));
  const measured = energyByJourney.filter(drive => drive.whPerMile !== null);
  const energyUsedKwh = measured.reduce((sum, drive) => sum + drive.energyUsedKwh!, 0);
  const measuredMiles = measured.reduce((sum, drive) => sum + drive.miles, 0);

  const validCharges = new Map<string, TessieRoadCharge>();
  for (const charge of charges) {
    if (!charge.id || !charge.journeyId || !validTime(charge.startedAt) || !validTime(charge.endedAt)
      || charge.startedAt >= charge.endedAt || charge.startedAt < range.startInclusive || charge.startedAt >= range.endExclusive
      || (charge.energyAddedKwh !== null && !validAmount(charge.energyAddedKwh))
      || !validBattery(charge.arrivalBatteryPercent) || !validBattery(charge.departureBatteryPercent)) continue;
    if (!validCharges.has(charge.id)) validCharges.set(charge.id, {
      ...charge, durationMinutes: (Date.parse(charge.endedAt) - Date.parse(charge.startedAt)) / 60_000,
      batteryGainedPercent: charge.arrivalBatteryPercent !== null && charge.departureBatteryPercent !== null
        ? charge.departureBatteryPercent - charge.arrivalBatteryPercent : null,
    });
  }
  const roadCharges = [...validCharges.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt) || a.id.localeCompare(b.id));
  const measuredCharges = roadCharges.filter(charge => charge.energyAddedKwh !== null);

  const routeGroups = new Map<string, TessieJourneyEnergy[]>();
  for (const drive of energyByJourney) {
    const start = label(drive.startingLocation), end = label(drive.endingLocation);
    if (!start || !end || /^unknown (start|destination)$/i.test(start) || /^unknown (start|destination)$/i.test(end)) continue;
    const key = JSON.stringify([drive.vehicleKey, start.toLocaleLowerCase(), end.toLocaleLowerCase()]);
    routeGroups.set(key, [...(routeGroups.get(key) ?? []), drive]);
  }
  const repeatedRoutes: TessieRouteComparison[] = [...routeGroups.values()].filter(group => group.length >= 2).map(group => {
    const measuredGroup = group.filter(drive => drive.whPerMile !== null);
    const groupMiles = measuredGroup.reduce((sum, drive) => sum + drive.miles, 0);
    const groupEnergy = measuredGroup.reduce((sum, drive) => sum + drive.energyUsedKwh!, 0);
    const efficiencies = measuredGroup.map(drive => drive.whPerMile!);
    return {
      vehicleKey: group[0]!.vehicleKey, startingLocation: label(group[0]!.startingLocation), endingLocation: label(group[0]!.endingLocation),
      journeys: group.length, journeyIds: group.map(drive => drive.journeyId),
      totalMiles: group.reduce((sum, drive) => sum + drive.miles, 0),
      measuredJourneys: measuredGroup.length, measuredMiles: groupMiles,
      totalEnergyUsedKwh: measuredGroup.length ? groupEnergy : null,
      averageWhPerMile: groupMiles ? groupEnergy * 1_000 / groupMiles : null,
      bestWhPerMile: efficiencies.length ? Math.min(...efficiencies) : null,
      worstWhPerMile: efficiencies.length ? Math.max(...efficiencies) : null,
    };
  }).sort((a, b) => b.journeys - a.journeys || a.startingLocation.localeCompare(b.startingLocation));
  return {
    range,
    drivingEfficiency: { journeys: energyByJourney.length, measuredJourneys: measured.length, measuredMiles,
      energyUsedKwh: measured.length ? energyUsedKwh : null, whPerMile: measuredMiles ? energyUsedKwh * 1_000 / measuredMiles : null },
    energyByJourney,
    chargingOnRoad: { sessions: roadCharges.length, measuredSessions: measuredCharges.length,
      energyAddedKwh: measuredCharges.length ? measuredCharges.reduce((sum, charge) => sum + charge.energyAddedKwh!, 0) : null,
      durationMinutes: roadCharges.reduce((sum, charge) => sum + charge.durationMinutes, 0), charges: roadCharges },
    repeatedRoutes,
  };
}
