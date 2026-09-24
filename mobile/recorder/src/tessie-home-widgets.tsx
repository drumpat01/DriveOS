import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useAppTheme } from './app-theme';
import { journeyDeckSemanticColors } from './journeydeck-design-tokens';
import type { TessieVehicleSnapshot } from './tessie-contract';
import { NativeSheet } from './native-sheet';

export type ActiveJourneyProgress = {
  startedAt: string;
  status: 'recording' | 'paused' | 'finishing';
  elapsed: string;
  distanceMiles: number;
  pointCount: number;
};

export function vehicleReadingAge(updatedAt: string | null, now = Date.now()) {
  if (!updatedAt) return { label: 'Reading time unavailable', stale: true };
  const timestamp = Date.parse(updatedAt);
  if (!Number.isFinite(timestamp) || timestamp > now + 5 * 60_000) return { label: 'Reading time unavailable', stale: true };
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  const stale = minutes >= 30;
  const label = minutes < 1 ? 'Updated just now' : minutes < 60 ? `Updated ${minutes}m ago` : `Updated ${Math.floor(minutes / 60)}h ago`;
  return { label: stale ? `${label} · stale` : label, stale };
}

function vehicleStatus(vehicle: TessieVehicleSnapshot) {
  const status = vehicle.status.trim().toLowerCase();
  const charge = vehicle.chargingState?.trim().toLowerCase();
  if (charge && charge !== 'disconnected' && charge !== 'stopped' && charge !== 'complete') return 'Charging';
  if (status === 'online') return 'Online';
  if (status === 'asleep' || status === 'sleeping') return 'Asleep';
  if (status === 'offline') return 'Offline';
  return vehicle.status ? vehicle.status[0]!.toUpperCase() + vehicle.status.slice(1) : 'Status unavailable';
}

export function YourCarWidget({ vehicles, loading, failed }: { vehicles: TessieVehicleSnapshot[]; loading: boolean; failed: boolean }) {
  const theme = useAppTheme();
  const c = journeyDeckSemanticColors(theme.id, theme.palette);
  const vehicle = vehicles.reduce<TessieVehicleSnapshot | undefined>((latest, candidate) => {
    const candidateAt = Date.parse(candidate.updatedAt ?? '') || 0;
    const latestAt = Date.parse(latest?.updatedAt ?? '') || 0;
    return candidateAt > latestAt ? candidate : latest ?? candidate;
  }, undefined);
  const age = vehicle ? vehicleReadingAge(vehicle.updatedAt) : null;
  const stale = Boolean(age?.stale || (failed && vehicle));
  return <View testID="home-tessie-your-car" accessibilityLabel="Your car" style={[styles.card, { backgroundColor: c.surfaceRaised, borderColor: c.separator }]}>
    <View style={styles.heading}><SymbolView name="car.side" tintColor={c.accent} size={18} /><Text style={[styles.title, { color: c.text }]}>Your car</Text></View>
    {vehicle ? <View style={styles.vehicleContent}>
      <View style={styles.vehicleTop}><Text numberOfLines={1} style={[styles.vehicleName, { color: c.text }]}>{vehicle.name}</Text><Text numberOfLines={1} style={[styles.status, { color: stale ? c.textSecondary : c.accent }]}>{vehicleStatus(vehicle)}{stale ? ' · Stale' : ''}</Text></View>
      <View style={styles.batteryRow}><Text style={[styles.battery, { color: c.text }]}>{vehicle.batteryPercent === null ? '—' : `${Math.round(vehicle.batteryPercent)}%`}</Text><Text style={[styles.batteryLabel, { color: c.textSecondary }]}>battery</Text>{vehicle.rangeMiles !== null && <Text style={[styles.range, { color: c.textSecondary }]}>{Math.round(vehicle.rangeMiles)} mi range</Text>}</View>
      <Text style={[styles.age, { color: c.textSecondary }]} numberOfLines={1}>{age?.label ?? 'Reading time unavailable'}{failed && !age?.stale ? ' · cached' : ''}</Text>
    </View> : <View style={styles.messageBox} accessibilityState={{ busy: loading }}>
      {loading ? <Text style={[styles.message, { color: c.textSecondary }]}>Loading your car…</Text> : <Text style={[styles.message, { color: c.textSecondary }]}>{failed ? 'Vehicle reading unavailable' : 'Connect Tessie in Settings to see your car.'}</Text>}
    </View>}
  </View>;
}

export function JourneyInProgressWidget({ progress, onOpen }: { progress: ActiveJourneyProgress | null; onOpen: () => void }) {
  const theme = useAppTheme();
  const c = journeyDeckSemanticColors(theme.id, theme.palette);
  const enabled = Boolean(progress);
  return <Pressable testID="home-tessie-journey-progress" accessibilityRole="button" accessibilityLabel={enabled ? 'Open active journey' : 'Journey in progress'} accessibilityHint={enabled ? 'Shows live recording details.' : 'No journey is currently recording.'} disabled={!enabled} onPress={onOpen} style={({ pressed }) => [styles.card, { backgroundColor: c.surfaceRaised, borderColor: c.separator }, pressed && enabled && { opacity: 0.76 }]}>
    <View style={styles.heading}><SymbolView name="location.north.line" tintColor={c.accent} size={18} /><Text style={[styles.title, { color: c.text }]}>Journey in progress</Text>{enabled && <SymbolView name="chevron.right" tintColor={c.textSecondary} size={13} />}</View>
    {progress ? <View style={styles.progressContent}>
      <View style={styles.vehicleTop}><Text style={[styles.status, { color: c.accent }]}>{progress.status === 'paused' ? 'PAUSED' : progress.status === 'finishing' ? 'SAVING' : 'RECORDING'}</Text><Text style={[styles.progressDuration, { color: c.text }]}>{progress.elapsed}</Text></View>
      <View style={styles.progressStats}><Metric label="Distance" value={`${progress.distanceMiles.toFixed(1)} mi`} color={c.text} secondary={c.textSecondary} /><Metric label="Route points" value={`${progress.pointCount}`} color={c.text} secondary={c.textSecondary} /></View>
      <Text style={[styles.age, { color: c.textSecondary }]} numberOfLines={1}>Started {new Date(progress.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</Text>
    </View> : <View style={styles.messageBox}><Text style={[styles.message, { color: c.textSecondary }]}>No journey is recording right now.</Text></View>}
  </Pressable>;
}

export function ActiveJourneyDetailsSheet({ visible, progress, onClose }: { visible: boolean; progress: ActiveJourneyProgress | null; onClose: () => void }) {
  const theme = useAppTheme();
  const c = journeyDeckSemanticColors(theme.id, theme.palette);
  if (!progress) return null;
  return <NativeSheet visible={visible} kicker="LIVE JOURNEY" title="Journey in progress" onClose={onClose}>
    <View testID="home-active-journey-details" style={{ padding: 18, gap: 14 }}>
      <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>{progress.status === 'paused' ? 'Journey paused' : progress.status === 'finishing' ? 'Saving journey' : 'Recording journey'}</Text>
      <Text style={{ color: c.textSecondary, fontSize: 14, lineHeight: 21 }}>Started {new Date(progress.startedAt).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })} · {progress.elapsed} elapsed</Text>
      <View style={[styles.progressStats, { paddingTop: 4 }]}>
        <Metric label="Distance" value={`${progress.distanceMiles.toFixed(1)} mi`} color={c.text} secondary={c.textSecondary} />
        <Metric label="Route points" value={`${progress.pointCount}`} color={c.text} secondary={c.textSecondary} />
      </View>
      <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 18 }}>Your route is being saved on this iPhone as it records.</Text>
    </View>
  </NativeSheet>;
}

function Metric({ label, value, color, secondary }: { label: string; value: string; color: string; secondary: string }) {
  return <View style={styles.metric}><Text style={[styles.metricValue, { color }]}>{value}</Text><Text style={[styles.metricLabel, { color: secondary }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  card: { minHeight: 132, flexGrow: 1, borderRadius: 22, borderWidth: 1, padding: 18, gap: 12, justifyContent: 'flex-start' },
  heading: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 9 },
  title: { fontSize: 17, fontWeight: '700', flex: 1 },
  vehicleContent: { minHeight: 76, justifyContent: 'space-between', gap: 4 },
  vehicleTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  vehicleName: { fontSize: 14, fontWeight: '600', flexShrink: 1 }, status: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  batteryRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 }, battery: { fontSize: 27, fontWeight: '700' }, batteryLabel: { fontSize: 12 }, range: { marginLeft: 'auto', fontSize: 12 }, age: { fontSize: 11, lineHeight: 15 },
  messageBox: { minHeight: 76, justifyContent: 'center' }, message: { fontSize: 13, lineHeight: 19 },
  progressContent: { minHeight: 76, justifyContent: 'space-between', gap: 6 }, progressDuration: { fontSize: 13, fontWeight: '700' },
  progressStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, metric: { minWidth: 72 }, metricValue: { fontSize: 17, fontWeight: '700' }, metricLabel: { fontSize: 10, marginTop: 1 },
});
