import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { requestStartJourney } from '../src/start-journey-link';

/** The widget's link: ask the recorder to start, then show Today. */
export default function StartJourneyRoute() {
  useEffect(() => { requestStartJourney(); }, []);
  return <Redirect href="/" />;
}
