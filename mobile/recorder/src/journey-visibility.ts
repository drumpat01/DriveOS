import type { JourneySummary } from './app-data';

function normalizedEndpoint(value: string | null | undefined) {
  return (value ?? '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

/**
 * Home and Work are useful endpoint labels, but a journey whose two resolved
 * endpoints are the same anchor is not useful in the visible road story.
 * Keep the stored recording intact so this presentation rule is reversible.
 */
export function isVisibleJourney(journey: Pick<JourneySummary, 'startingLocation' | 'endingLocation'>) {
  const start = normalizedEndpoint(journey.startingLocation);
  const end = normalizedEndpoint(journey.endingLocation);
  return !((start === 'home' && end === 'home') || (start === 'work' && end === 'work'));
}

export function visibleJourneys<T extends Pick<JourneySummary, 'startingLocation' | 'endingLocation'>>(journeys: T[]) {
  return journeys.filter(isVisibleJourney);
}
