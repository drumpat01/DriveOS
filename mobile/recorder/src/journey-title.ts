type JourneyTitleSource = {
  startedAt: string;
  startingLocation?: string | null;
  endingLocation?: string | null;
};

function shortCityName(label: string | null | undefined) {
  return label?.split(',')[0]?.trim() || null;
}

export function journeyFallbackTitle(startedAt: string) {
  const date = new Date(startedAt);
  if (Number.isNaN(date.getTime())) return 'Recent drive';
  const hour = date.getHours();
  const moment = hour < 5 ? 'late-night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
  const weekday = date.toLocaleDateString(undefined, { weekday: 'long' });
  return `${weekday} ${moment} drive`;
}

export function journeyDisplayTitle(journey: JourneyTitleSource, cityLabel?: string | null) {
  const start = journey.startingLocation?.trim();
  const end = journey.endingLocation?.trim();
  if (start && end) return `${start} → ${end}`;
  if (start || end) return start || end || journeyFallbackTitle(journey.startedAt);
  const city = shortCityName(cityLabel);
  return city ? `${city} drive` : journeyFallbackTitle(journey.startedAt);
}
