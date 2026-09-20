import { MARKER_OTA_COMPAT } from './journey-marker-compatibility';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useThemedStyles } from './app-theme';
import { getCurrentUser } from './auth';
import { listMarkerJourneys } from './journey-marker-store';
import { subscribeLocalArchiveChanges } from './local-archive-events';
import { useJourneyDeckMembership } from './membership-store';
import { membershipCanAccessDate } from './membership-entitlements';
import { V3_MARKERS_PROTOTYPE_ENABLED } from './release-features';

/** Retains the original route URL so saved links open the implemented feature. */
export function MarkersLibraryScreen() {
  const styles = useThemedStyles(baseStyles), membership = useJourneyDeckMembership();
  const [, refresh] = useState(0);
  useEffect(() => subscribeLocalArchiveChanges(() => refresh(value => value + 1)), []);
  const items = V3_MARKERS_PROTOTYPE_ENABLED ? listMarkerJourneys(getCurrentUser().id)
    .filter(journey => membershipCanAccessDate(membership.state.entitlements, journey.startedAt)) : [];
  return <FlatList testID="markers-library" data={items} keyExtractor={item => item.id} style={styles.page}
    contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}
    ListHeaderComponent={<View style={styles.header}><Text style={styles.title}>Keep the moments between destinations.</Text>
      <Text style={styles.body}>{MARKER_OTA_COMPAT ? 'While recording with JourneyDeck open, tap Create a marker. This saves a real timestamp and GPS location to your active journey.' : 'While recording, say “Siri, create a marker in JourneyDeck V3,” or tap Create a marker in the recorder.'}</Text>
      <Text style={styles.body}>{MARKER_OTA_COMPAT ? 'After your drive, tap a polaroid pin to add notes and photos. Siri capture requires the next app build.' : 'After your drive, open a journey and tap its polaroid pin to add notes or photos.'}</Text>
      <Text style={styles.body}>Saved privately on this device. Markers are not yet included in iCloud sync.</Text>
      <Text style={styles.title}>Journeys with markers</Text></View>}
    ListEmptyComponent={<Text style={styles.body}>{V3_MARKERS_PROTOTYPE_ENABLED ? 'Completed journeys with markers will appear here. You can also find them below each journey’s route.' : 'Markers are available in JourneyDeck V3.'}</Text>}
    renderItem={({ item }) => <Pressable accessibilityRole="button" style={styles.card}
      onPress={() => router.push({ pathname: '/journey/[id]', params: { id: item.id } })}>
      <Text style={styles.title}>▣  {new Date(item.startedAt).toLocaleDateString()}</Text>
      <Text style={styles.body}>{new Date(item.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · Open route & markers  ›</Text>
    </Pressable>} />;
}
const baseStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#08070d' }, content: { padding: 20, paddingBottom: 48, gap: 14 },
  header: { gap: 16, marginBottom: 12 }, title: { color: '#fff6ed', fontWeight: '700', fontSize: 20 },
  body: { color: '#b9aec9', fontSize: 16, lineHeight: 24 },
  card: { backgroundColor: '#101522', borderColor: '#777083', borderWidth: 1, borderRadius: 18, padding: 18, gap: 10 },
});
