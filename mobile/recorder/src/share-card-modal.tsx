import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import { appDataClient, type JourneyPhoto } from './app-data';

export type ShareCardPayload = {
  kind: 'memory' | 'collection' | 'journey';
  eyebrow: string;
  title: string;
  subtitle: string;
  metrics: { label: string; value: string }[];
  photo?: JourneyPhoto | null;
  accent?: string;
};

export function ShareCardModal({ payload, onClose }: { payload: ShareCardPayload | null; onClose: () => void }) {
  const cardRef = useRef<View>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let active = true;
    setPhotoUri(null);
    setPhotoLoading(Boolean(payload?.photo));
    if (payload?.photo) void appDataClient.photoDataUrl(payload.photo).then(uri => { if (active) setPhotoUri(uri); }).catch(() => undefined).finally(() => { if (active) setPhotoLoading(false); });
    return () => { active = false; };
  }, [payload?.photo?.id]);

  const share = async () => {
    if (!payload || !cardRef.current) return;
    setSharing(true);
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: 1350 });
      await Sharing.shareAsync(uri, { UTI: 'public.png', mimeType: 'image/png', dialogTitle: `Share ${payload.title}` });
    } catch (error) {
      Alert.alert('Card not shared', error instanceof Error ? error.message : 'JourneyDeck could not create this share card.');
    } finally {
      setSharing(false);
    }
  };

  const accent = payload?.accent ?? '#ff7658';
  return <Modal visible={Boolean(payload)} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
    <SafeAreaView style={styles.modalRoot}>
      <Pressable accessibilityLabel="Close share card" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <View><Text style={styles.sheetKicker}>PRIVACY-SAFE PREVIEW</Text><Text style={styles.sheetTitle}>Share card</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.previewWrap} showsVerticalScrollIndicator={false}>
          {payload && <View ref={cardRef} collapsable={false} style={styles.card}>
            {photoUri ? <Image source={{ uri: photoUri }} resizeMode="cover" style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: '#120b21' }]}><View style={[styles.orb, { backgroundColor: accent }]} /><View style={[styles.route, { backgroundColor: accent }]} /><View style={[styles.route, styles.routeTwo]} /></View>}
            <View style={styles.shade} />
            <View style={styles.cardTop}><View style={[styles.mark, { backgroundColor: accent }]}><Text style={styles.markText}>J</Text></View><Text style={styles.wordmark}>JOURNEYDECK</Text></View>
            <View style={styles.cardCopy}>
              <Text style={[styles.cardEyebrow, { color: accent }]}>{payload.eyebrow}</Text>
              <Text style={styles.cardTitle}>{payload.title}</Text>
              <Text style={styles.cardSubtitle}>{payload.subtitle}</Text>
              <View style={styles.metrics}>{payload.metrics.slice(0, 3).map(metric => <View key={metric.label} style={styles.metric}><Text style={styles.metricValue}>{metric.value}</Text><Text style={styles.metricLabel}>{metric.label}</Text></View>)}</View>
              <View style={styles.privacyLine}><Text style={styles.privacyText}>PRECISE LOCATIONS HIDDEN  •  YOUR DRIVE, REMEMBERED.</Text></View>
            </View>
          </View>}
          <View style={styles.privacyNote}><Text style={styles.privacyNoteTitle}>Built to share safely</Text><Text style={styles.privacyNoteText}>The image excludes precise routes, street addresses, and private coordinates. Only the summary shown above is exported.</Text></View>
        </ScrollView>
        <Pressable accessibilityRole="button" onPress={() => void share()} disabled={sharing || photoLoading} style={[styles.shareButton, (sharing || photoLoading) && styles.disabled]}>{sharing || photoLoading ? <ActivityIndicator color="#1a0907" /> : <Text style={styles.shareText}>Share image</Text>}</Pressable>
      </View>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#030106cc' },
  sheet: { maxHeight: '94%', margin: 8, overflow: 'hidden', borderRadius: 28, borderWidth: 1, borderColor: '#704d8b', backgroundColor: '#0a0710', shadowColor: '#000', shadowOpacity: 0.8, shadowRadius: 28, shadowOffset: { width: 0, height: -8 } },
  sheetHeader: { minHeight: 72, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#3b2946' },
  sheetKicker: { color: '#ff795b', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }, sheetTitle: { color: '#f8f3fa', fontSize: 22, fontWeight: '900', marginTop: 3 },
  closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#4e3a5b', backgroundColor: '#17101f' }, closeText: { color: '#d6c7df', fontSize: 27, lineHeight: 29 },
  previewWrap: { alignItems: 'center', padding: 18, gap: 14 },
  card: { width: 324, height: 405, overflow: 'hidden', borderRadius: 24, backgroundColor: '#120b21', borderWidth: 1, borderColor: '#ffffff22' },
  orb: { position: 'absolute', width: 280, height: 280, borderRadius: 140, opacity: 0.2, right: -90, top: -55 },
  route: { position: 'absolute', width: 410, height: 5, borderRadius: 3, left: -70, top: 170, opacity: 0.75, transform: [{ rotate: '-20deg' }] }, routeTwo: { top: 225, left: 65, opacity: 0.32, transform: [{ rotate: '25deg' }] },
  shade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#08040aa8' },
  cardTop: { position: 'absolute', left: 23, right: 23, top: 23, flexDirection: 'row', alignItems: 'center', gap: 10 }, mark: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, markText: { color: '#fff', fontSize: 20, fontWeight: '900' }, wordmark: { color: '#f8f4fa', fontSize: 10, fontWeight: '900', letterSpacing: 2.1 },
  cardCopy: { position: 'absolute', left: 23, right: 23, bottom: 22 }, cardEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.6 }, cardTitle: { color: '#fff', fontSize: 33, lineHeight: 35, fontWeight: '900', letterSpacing: -1, marginTop: 8 }, cardSubtitle: { color: '#d2c8d8', fontSize: 13, lineHeight: 19, marginTop: 9 },
  metrics: { flexDirection: 'row', marginTop: 18, overflow: 'hidden', borderRadius: 15, borderWidth: 1, borderColor: '#ffffff1f', backgroundColor: '#08050bcc' }, metric: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#ffffff20' }, metricValue: { color: '#fff', fontSize: 17, fontWeight: '900' }, metricLabel: { color: '#9e91a7', fontSize: 7, fontWeight: '900', letterSpacing: 1.1, marginTop: 5 },
  privacyLine: { marginTop: 13 }, privacyText: { color: '#958a9e', fontSize: 6.5, fontWeight: '800', letterSpacing: 0.7 },
  privacyNote: { width: '100%', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#285b4e', backgroundColor: '#0c201b' }, privacyNoteTitle: { color: '#5ce0b6', fontSize: 12, fontWeight: '900' }, privacyNoteText: { color: '#9db6ad', fontSize: 10, lineHeight: 15, marginTop: 4 },
  shareButton: { minHeight: 56, margin: 14, marginTop: 0, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ff795b' }, shareText: { color: '#1a0907', fontSize: 15, fontWeight: '900' }, disabled: { opacity: 0.55 },
});
