import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { V3_MARKERS_PROTOTYPE_ENABLED } from './release-features';

const palette = {
  page: '#081832', card: '#203a63', inset: '#132d55', text: '#f6f0e2', muted: '#b6bfcc',
  champagne: '#d4b15a', green: '#2f6b57', blue: '#6fa5f0', chrome: '#d5dbe3',
};
const CONTENT_MAX_WIDTH = 720;

type MarkerAttachment = 'photo' | 'voice';

export function MarkersPrototypeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [note, setNote] = useState('The light through the trees made this part of the drive feel completely still.');
  const [attachments, setAttachments] = useState<MarkerAttachment[]>([]);
  const [saved, setSaved] = useState(false);
  const contentWidth = Math.min(CONTENT_MAX_WIDTH, Math.max(280, width - 36));

  if (!V3_MARKERS_PROTOTYPE_ENABLED) {
    return <View style={[styles.unavailable, { paddingBottom: insets.bottom + 18 }]}>
      <Text style={styles.unavailableTitle}>Markers are a V3 preview.</Text>
      <Text style={styles.unavailableBody}>Open this interaction prototype from the isolated JourneyDeck V3 preview.</Text>
    </View>;
  }

  const toggleAttachment = (attachment: MarkerAttachment) => {
    setSaved(false);
    setAttachments(current => current.includes(attachment) ? current.filter(item => item !== attachment) : [...current, attachment]);
  };

  return <View testID="markers-standard-header" style={styles.screen}>
    <ScrollView testID="markers-scroll" contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <View style={{ width: contentWidth, alignSelf: 'center', gap: 20 }}>
        <SiriCaptureCard />
        <MarkerRoutePreview />
        <MarkerEditor note={note} attachments={attachments} saved={saved}
          onNote={value => { setNote(value); setSaved(false); }}
          onToggleAttachment={toggleAttachment} onSave={() => setSaved(true)} />
      </View>
    </ScrollView>
  </View>;
}

function SiriCaptureCard() {
  return <View style={styles.siriCard}>
    <View style={styles.siriIcon}><SymbolView name="waveform" tintColor={palette.page} size={23} /></View>
    <View style={styles.flex}>
      <Text style={styles.eyebrow}>HANDS-FREE CAPTURE</Text>
      <Text style={styles.siriPhrase}>“Hey Siri, create a marker in JourneyDeck.”</Text>
      <Text style={styles.body}>JourneyDeck adds the moment to the active journey without opening the app or asking you to look at the screen.</Text>
    </View>
  </View>;
}

function MarkerRoutePreview() {
  return <View style={styles.routeCard}>
    <View style={styles.sectionHeading}><View><Text style={styles.eyebrow}>JOURNEY ROUTE</Text><Text style={styles.sectionTitle}>Moments from the road</Text></View><Text style={styles.markerCount}>1 MARKER</Text></View>
    <View style={styles.routeCanvas}>
      <LinearGradient colors={['#254a48', palette.green, '#102a35', palette.page]} locations={[0, 0.34, 0.72, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.mapGrid} />
      <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 390 220" style={StyleSheet.absoluteFill}>
        <Path d="M-18 181 C 47 146, 91 190, 142 133 S 229 66, 284 102 S 348 92, 412 31" fill="none" stroke="#f6f0e2" strokeOpacity={0.28} strokeWidth={17} strokeLinecap="round" />
        <Path d="M-18 181 C 47 146, 91 190, 142 133 S 229 66, 284 102 S 348 92, 412 31" fill="none" stroke={palette.champagne} strokeWidth={4} strokeLinecap="round" strokeDasharray="9 7" />
        <Circle cx="31" cy="163" r="8" fill={palette.page} stroke={palette.chrome} strokeWidth={3} />
        <Circle cx="365" cy="78" r="8" fill={palette.page} stroke={palette.chrome} strokeWidth={3} />
      </Svg>
      <SongPin number={1} style={{ left: '23%', top: '57%' }} />
      <SongPin number={2} style={{ left: '68%', top: '37%' }} />
      <View accessibilityLabel="Marker 1, saved at 4:42 PM" style={[styles.polaroidPin, { left: '48%', top: '20%' }]}>
        <View style={styles.polaroidPhoto}><SymbolView name="photo.on.rectangle" tintColor={palette.page} size={17} /></View>
        <View style={styles.polaroidTail} />
      </View>
    </View>
    <View style={styles.legend}><Legend symbol="music.note" label="Songs keep their numbered pins" /><Legend symbol="photo.on.rectangle" label="Markers use a polaroid pin" /></View>
  </View>;
}

function SongPin({ number, style }: { number: number; style: object }) {
  return <View accessibilityLabel={`Song ${number}`} style={[styles.songPin, style]}><Text style={styles.songPinText}>{number}</Text></View>;
}

function Legend({ symbol, label }: { symbol: SFSymbol; label: string }) {
  return <View style={styles.legendItem}><SymbolView name={symbol} tintColor={palette.champagne} size={14} /><Text style={styles.legendText}>{label}</Text></View>;
}

function MarkerEditor({ note, attachments, saved, onNote, onToggleAttachment, onSave }: {
  note: string; attachments: MarkerAttachment[]; saved: boolean;
  onNote: (value: string) => void; onToggleAttachment: (value: MarkerAttachment) => void; onSave: () => void;
}) {
  const summary = useMemo(() => attachments.length ? attachments.map(item => item === 'photo' ? 'Photo' : 'Voice memo').join(' · ') : 'No attachments yet', [attachments]);
  return <View testID="marker-editor" style={styles.editor}>
    <View style={styles.markerHeader}>
      <View style={styles.markerBadge}><SymbolView name="photo.on.rectangle" tintColor={palette.page} size={22} /></View>
      <View style={styles.flex}><Text style={styles.eyebrow}>MARKER 1</Text><Text style={styles.markerTitle}>Forest overlook</Text><Text style={styles.markerMeta}>Captured on this journey · 4:42 PM</Text></View>
    </View>
    <View><Text style={styles.fieldTitle}>Add what made this moment matter</Text><Text style={styles.body}>Come back after the drive to turn the pin into a tiny memory inside the Journey.</Text></View>
    <TextInput accessibilityLabel="Marker note" multiline maxLength={500} value={note} onChangeText={onNote}
      placeholder="Add a note about this marker…" placeholderTextColor="#8492a7" selectionColor={palette.champagne} style={styles.noteInput} />
    <View style={styles.attachmentRow}>
      <AttachmentButton label="Add photos" symbol="photo.fill" selected={attachments.includes('photo')} onPress={() => onToggleAttachment('photo')} />
      <AttachmentButton label="Voice memo" symbol="mic.fill" selected={attachments.includes('voice')} onPress={() => onToggleAttachment('voice')} />
    </View>
    <Text style={styles.attachmentSummary}>{summary}</Text>
    <View style={styles.privacyNote}><SymbolView name="lock.fill" tintColor={palette.green} size={16} /><Text style={styles.privacyText}>Markers belong to this Journey. The final feature will preserve JourneyDeck’s local-first privacy boundaries.</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel="Save marker" onPress={onSave} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
      <LinearGradient colors={[palette.champagne, '#e5ca82']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Text style={styles.saveButtonText}>{saved ? 'Marker saved in prototype' : 'Save marker'}</Text><SymbolView name={saved ? 'checkmark.circle.fill' : 'arrow.right'} tintColor={palette.page} size={18} weight="bold" />
    </Pressable>
    <Text style={styles.prototypeNote}>Interaction prototype only—this screen does not yet record, import, or persist media.</Text>
  </View>;
}

function AttachmentButton({ label, symbol, selected, onPress }: { label: string; symbol: SFSymbol; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={onPress}
    style={({ pressed }) => [styles.attachmentButton, selected && styles.attachmentButtonSelected, pressed && styles.pressed]}>
    <SymbolView name={selected ? 'checkmark.circle.fill' : symbol} tintColor={selected ? palette.page : palette.chrome} size={20} />
    <Text style={[styles.attachmentLabel, selected && styles.attachmentLabelSelected]}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.page }, content: { paddingHorizontal: 18, paddingTop: 18 }, flex: { flex: 1, minWidth: 0 },
  siriCard: { flexDirection: 'row', gap: 13, borderRadius: 22, borderWidth: 1, borderColor: `${palette.champagne}99`, backgroundColor: palette.card, padding: 16 },
  siriIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.champagne },
  eyebrow: { color: palette.champagne, fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1.7 },
  siriPhrase: { color: palette.text, fontSize: 18, lineHeight: 24, fontWeight: '900', marginTop: 5 }, body: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  routeCard: { borderRadius: 24, borderWidth: 1, borderColor: '#647595', backgroundColor: palette.card, padding: 14, gap: 13 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }, sectionTitle: { color: palette.text, fontSize: 19, lineHeight: 24, fontWeight: '900', marginTop: 3 },
  markerCount: { color: palette.champagne, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, routeCanvas: { height: 220, borderRadius: 18, overflow: 'hidden' },
  mapGrid: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0.15, borderWidth: 28, borderColor: '#81a098', transform: [{ rotate: '-8deg' }, { scale: 1.16 }] },
  songPin: { position: 'absolute', width: 29, height: 29, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: palette.champagne, backgroundColor: palette.page }, songPinText: { color: palette.text, fontSize: 12, fontWeight: '900' },
  polaroidPin: { position: 'absolute', width: 42, height: 50, alignItems: 'center' }, polaroidPhoto: { zIndex: 2, width: 40, height: 40, borderRadius: 10, borderWidth: 3, borderColor: palette.text, backgroundColor: palette.champagne, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] }, polaroidTail: { width: 12, height: 12, marginTop: -7, backgroundColor: palette.text, transform: [{ rotate: '45deg' }] },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 145, flexGrow: 1 }, legendText: { color: palette.muted, fontSize: 10, lineHeight: 14 },
  editor: { borderRadius: 24, borderWidth: 1, borderColor: '#647595', backgroundColor: palette.card, padding: 16, gap: 18 }, markerHeader: { flexDirection: 'row', alignItems: 'center', gap: 13 }, markerBadge: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.champagne },
  markerTitle: { color: palette.text, fontSize: 21, lineHeight: 26, fontWeight: '900', marginTop: 3 }, markerMeta: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 3 }, fieldTitle: { color: palette.text, fontSize: 17, lineHeight: 22, fontWeight: '800' },
  noteInput: { minHeight: 124, borderRadius: 20, borderWidth: 1, borderColor: '#7283a3', backgroundColor: palette.inset, color: palette.text, fontSize: 15, lineHeight: 22, textAlignVertical: 'top', padding: 16 },
  attachmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, attachmentButton: { minHeight: 52, flexBasis: '45%', flexGrow: 1, borderRadius: 16, borderWidth: 1, borderColor: '#647595', backgroundColor: palette.inset, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 }, attachmentButtonSelected: { borderColor: palette.champagne, backgroundColor: palette.champagne }, attachmentLabel: { color: palette.chrome, fontSize: 13, fontWeight: '800' }, attachmentLabelSelected: { color: palette.page }, attachmentSummary: { color: palette.muted, fontSize: 11, marginTop: -10 },
  privacyNote: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }, privacyText: { flex: 1, color: palette.muted, fontSize: 11, lineHeight: 16 }, saveButton: { minHeight: 54, borderRadius: 18, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, saveButtonText: { color: palette.page, fontSize: 15, fontWeight: '900' }, prototypeNote: { color: palette.muted, fontSize: 10, lineHeight: 15, textAlign: 'center' }, pressed: { opacity: 0.68 },
  unavailable: { flex: 1, backgroundColor: palette.page, paddingHorizontal: 22, justifyContent: 'center' }, unavailableTitle: { color: palette.text, fontSize: 25, fontWeight: '900' }, unavailableBody: { color: palette.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
});
