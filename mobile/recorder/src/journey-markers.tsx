import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { captureJourneyMarker } from './journey-marker-capture';
import { MARKER_OTA_COMPAT } from './journey-marker-compatibility';
import { getCurrentUser } from './auth';
import { syncNativeRecorderInbox } from './native-recorder-inbox';
import { subscribeLocalArchiveChanges } from './local-archive-events';
import { useAppTheme, useThemedStyles } from './app-theme';
import { NativeSheet } from './native-sheet';
import { InteractiveRouteMap } from './interactive-route-map';
import { activeSession } from './storage';
import { V3_MARKERS_PROTOTYPE_ENABLED } from './release-features';
import { listTessieChargeMarkers, type LocalTessieChargeMarker } from './local-store';
import { addMarkerMedia, listJourneyMarkers, listMarkerMedia, markerMediaUri, removeMarkerMedia, saveMarkerNotes, type JourneyMarker } from './journey-marker-store';

export function CreateJourneyMarkerButton({ sessionId }: { sessionId: string }) {
  const styles = useThemedStyles(baseStyles);
  const busy = useRef(false);
  const [message, setMessage] = useState('Save this moment · add details after your drive');
  const [saving, setSaving] = useState(false);
  if (!V3_MARKERS_PROTOTYPE_ENABLED) return null;
  return <Pressable accessibilityRole="button" accessibilityLabel="Create a marker" disabled={saving}
    style={styles.card} onPress={() => {
      if (busy.current) return;
      busy.current = true; setSaving(true);
      void (async () => {
        try {
          await captureJourneyMarker(sessionId);
          setMessage('Marker saved. Add details after your drive.');
          // Capture is already durable even if foreground import must retry later.
          await syncNativeRecorderInbox().catch(() => undefined);
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save the marker.'); }
        finally { busy.current = false; setSaving(false); }
      })();
    }}>
    <Text style={styles.title}>{saving ? 'Saving marker…' : '▣  Create a marker'}</Text>
    <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text>
  </Pressable>;
}

export function JourneyMarkerRoute({ journeyId, ...props }: ComponentProps<typeof InteractiveRouteMap> & { journeyId: string }) {
  const styles = useThemedStyles(baseStyles);
  const userId = getCurrentUser().id;
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<JourneyMarker | null>(null);
  const [selectedCharge, setSelectedCharge] = useState<LocalTessieChargeMarker | null>(null);
  useEffect(() => subscribeLocalArchiveChanges(() => setRevision(value => value + 1)), []);
  useEffect(() => { setSelected(null); setSelectedCharge(null); }, [journeyId, userId]);
  void revision;
  const markers = V3_MARKERS_PROTOTYPE_ENABLED ? listJourneyMarkers(userId, journeyId) : [];
  const chargeMarkers = listTessieChargeMarkers(userId, journeyId);
  return <>
    <InteractiveRouteMap {...props} markers={markers} onSelectMarker={setSelected}
      chargeMarkers={chargeMarkers} onSelectCharge={setSelectedCharge} />
    {chargeMarkers.length > 0 && <View style={styles.section} testID="tessie-charge-stops">
      <Text style={styles.title}>Supercharger stops · {chargeMarkers.length}</Text>
      {chargeMarkers.map(charge => <Pressable key={charge.id} accessibilityRole="button" onPress={() => setSelectedCharge(charge)} style={styles.card}>
        <Text style={styles.title}>{charge.location}</Text>
        <Text style={styles.body}>{new Date(charge.startedAt).toLocaleString()} · {Math.max(0, Math.round((Date.parse(charge.endedAt) - Date.parse(charge.startedAt)) / 60_000))} min stopped</Text>
        <Text style={styles.body}>{charge.arrivalBatteryPercent ?? '—'}% arrival → {charge.departureBatteryPercent ?? '—'}% departure · {charge.energyAddedKwh === null ? 'Energy unknown' : `${charge.energyAddedKwh.toFixed(1)} kWh added`}</Text>
      </Pressable>)}
    </View>}
    {V3_MARKERS_PROTOTYPE_ENABLED && <View style={styles.section}>
      <Text style={styles.title}>Moments · {markers.length}</Text>
      {!markers.length && <Text style={styles.body}>{MARKER_OTA_COMPAT ? 'Tap Create a marker while recording. Your saved moments appear here. Siri capture requires the next app build.' : 'While recording, say “Siri, create a marker in JourneyDeck.” Your saved moments appear here.'}</Text>}
      {markers.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.momentStrip}>{markers.map((marker, index) => <Pressable key={marker.id} accessibilityRole="button" style={styles.momentCard} onPress={() => setSelected(marker)}>
        <Text style={styles.momentTime}>{new Date(marker.capturedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
        <Text style={styles.momentTitle}>Moment {index + 1}</Text>
        <Text style={styles.momentBody} numberOfLines={2}>{marker.notes || 'Add notes or photos'}</Text>
      </Pressable>)}</ScrollView> : null}
    </View>}
    {selected && <MarkerEditor key={`${userId}:${selected.id}`} userId={userId} marker={selected} onClose={() => setSelected(null)} />}
    {selectedCharge && <NativeSheet visible kicker="SUPERCHARGER STOP" title={selectedCharge.location} onClose={() => setSelectedCharge(null)}>
      <Text style={styles.body}>Arrival battery: {selectedCharge.arrivalBatteryPercent ?? 'Unavailable'}{selectedCharge.arrivalBatteryPercent == null ? '' : '%'}</Text>
      <Text style={styles.body}>Departure battery: {selectedCharge.departureBatteryPercent ?? 'Unavailable'}{selectedCharge.departureBatteryPercent == null ? '' : '%'}</Text>
      <Text style={styles.body}>Energy added: {selectedCharge.energyAddedKwh === null ? 'Unknown' : `${selectedCharge.energyAddedKwh.toFixed(1)} kWh`}</Text>
      <Text style={styles.body}>Time stopped: {Math.max(0, Math.round((Date.parse(selectedCharge.endedAt) - Date.parse(selectedCharge.startedAt)) / 60_000))} minutes</Text>
    </NativeSheet>}
  </>;
}

function MarkerEditor({ userId, marker, onClose }: { userId: string; marker: JourneyMarker; onClose: () => void }) {
  const styles = useThemedStyles(baseStyles), theme = useAppTheme();
  const [notes, setNotes] = useState(marker.notes), [savedNotes, setSavedNotes] = useState(marker.notes);
  const [media, setMedia] = useState(() => listMarkerMedia(userId, marker.id));
  const [busy, setBusy] = useState(false);
  const editingBlocked = Boolean(activeSession());
  const refresh = () => setMedia(listMarkerMedia(userId, marker.id));
  const perform = async (action: () => Promise<void> | void) => {
    setBusy(true);
    try { await action(); refresh(); }
    catch (error) { Alert.alert('Marker', error instanceof Error ? error.message : 'Unable to save. Please try again.'); }
    finally { setBusy(false); }
  };
  const addPhoto = () => perform(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: false });
    if (result.canceled) return;
    const asset = result.assets[0]!;
    const image = await manipulateAsync(asset.uri, asset.width > 2048 ? [{ resize: { width: 2048 } }] : [], { compress: 0.9, format: SaveFormat.JPEG });
    try { await addMarkerMedia(userId, marker.id, 'photo', image.uri); }
    finally { await FileSystem.deleteAsync(image.uri, { idempotent: true }); }
  });
  return <NativeSheet surface="frost" animateChrome={!editingBlocked} visible kicker="JOURNEY MARKER" title="Remember this moment" onClose={onClose} busy={busy} dirty={notes !== savedNotes}
    footer={<Pressable accessibilityRole="button" disabled={busy || editingBlocked} style={[styles.saveButton, { backgroundColor: theme.palette.accent }, (busy || editingBlocked) && { opacity: 0.55 }]} onPress={() => void perform(() => { saveMarkerNotes(userId, marker.id, notes); setSavedNotes(notes); })}><Text style={[styles.title, { color: theme.palette.onAccent }]}>Save notes</Text></Pressable>}>
    <Text style={styles.body}>{new Date(marker.capturedAt).toLocaleString()}</Text>
    <Text style={styles.body}>Location accuracy: ±{Math.round(marker.accuracyMeters)} m · GPS fix {Math.max(0, Math.round((Date.parse(marker.capturedAt) - Date.parse(marker.locationAt)) / 1000))} seconds before capture</Text>
    {editingBlocked && <Text style={styles.body}>Finish your journey before adding details.</Text>}
    <TextInput accessibilityLabel="Marker notes" multiline editable={!editingBlocked && !busy} maxLength={10000} value={notes} onChangeText={setNotes}
      placeholder="What made this moment special?" placeholderTextColor={theme.palette.muted} style={styles.notes} />
    <Text accessibilityLiveRegion="polite" style={styles.body}>{notes !== savedNotes ? 'Unsaved note changes · tap Save notes.' : 'Notes saved.'} Photos save automatically when added.</Text>
    <View style={styles.row}>
      <Pressable accessibilityRole="button" disabled={editingBlocked || busy} onPress={() => void addPhoto()} style={styles.card}><Text style={styles.title}>Add photo</Text></Pressable>
    </View>
    {media.map(item => <View key={item.id} style={styles.card}>
      <Image source={markerMediaUri(userId, item)} style={styles.photo} contentFit="contain" accessibilityLabel="Marker photo" />
      <Pressable accessibilityRole="button" accessibilityLabel="Remove photo" disabled={busy || editingBlocked} style={styles.action}
        onPress={() => Alert.alert('Remove attachment?', 'This removes the saved attachment from this marker.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => void perform(() => removeMarkerMedia(userId, marker.id, item)) }])}>
        <Text style={styles.body}>Remove photo</Text>
      </Pressable>
    </View>)}
    <Text style={styles.body}>Markers and attachments are saved on this device. They are not included in share cards or iCloud sync.</Text>
  </NativeSheet>;
}

const baseStyles = StyleSheet.create({
  section: { gap: 10, marginVertical: 14 }, momentStrip: { gap: 10, paddingRight: 18 },
  momentCard: { width: 176, minHeight: 94, backgroundColor: '#101522', borderColor: '#51495b', borderWidth: 1, borderRadius: 18, padding: 14, gap: 5 },
  momentTime: { color: '#b89ee0', fontSize: 10, fontWeight: '800', fontVariant: ['tabular-nums'] }, momentTitle: { color: '#fff6ed', fontSize: 15, fontWeight: '800' }, momentBody: { color: '#a99eb8', fontSize: 12, lineHeight: 17 },
  card: { backgroundColor: '#101522', borderColor: '#777083', borderWidth: 1, borderRadius: 18, padding: 16, gap: 8, marginVertical: 4 },
  title: { color: '#fff6ed', fontSize: 17, fontWeight: '700' },
  body: { color: '#b9aec9', fontSize: 14, lineHeight: 21 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  notes: { color: '#fff6ed', backgroundColor: '#101522', borderWidth: 1, borderColor: '#777083', borderRadius: 16, padding: 14, minHeight: 130, textAlignVertical: 'top', fontSize: 17 },
  photo: { width: '100%', height: 240, borderRadius: 12 },
  action: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 },
  saveButton: { minHeight: 58, borderRadius: 18, padding: 16, alignItems: 'center', justifyContent: 'center' },
});
