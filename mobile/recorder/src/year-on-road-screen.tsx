import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAppTheme } from './app-theme';
import { getCurrentUser } from './auth';
import { DetailScreenFrame } from './detail-screen-frame';
import { useJourneyDeckNavigation } from './native-navigation-context';
import { loadYearOnRoadData } from './feature-archive-data';
import { YearOnRoadViewer } from './year-on-road';
import type { YearOnRoadData } from './year-on-road-model';
import { activeSession } from './storage';
import { getNativeAutomaticRecorderStatus } from '../modules/journeydeck-recorder';

export function NativeYearOnRoadScreen() {
  const theme = useAppTheme(), nav = useJourneyDeckNavigation(), [owner] = useState(() => getCurrentUser().id);
  const [data, setData] = useState<YearOnRoadData | null>(null), [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0);
  const [soundAllowed, setSoundAllowed] = useState(false);
  const premium = nav.membership.tier === 'paid';
  useEffect(() => { let cancelled = false, checking = false;
    const check = async () => {
      if (checking) return; checking = true;
      try { const native = await getNativeAutomaticRecorderStatus();
        if (!cancelled) setSoundAllowed(!activeSession() && (!native.nativeModuleAvailable || (native.statusReliable !== false && !native.recording && !native.paused && !native.sessionId)));
      } catch { if (!cancelled) setSoundAllowed(false); } finally { checking = false; }
    };
    void check(); const timer = setInterval(() => { void check(); }, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);
  useEffect(() => { let cancelled = false; setData(null); setError(null);
    if (!premium) return;
    const timer = setTimeout(() => { void loadYearOnRoadData(owner, () => cancelled).then(value => { if (!cancelled) setData(value); })
      .catch(failure => { if (!cancelled) setError(failure instanceof Error ? failure.message : 'Your recap could not be prepared.'); }); }, 150);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [owner, premium, attempt]);
  const close = () => router.back();
  return <DetailScreenFrame title="Your Year on the Road" onBack={close}>
    <View style={{ padding: 28, gap: 20 }}>
      {!premium ? <><Text style={{ color: theme.palette.text, fontSize: 28, fontWeight: '800' }}>A year worth reliving.</Text>
        <Text style={{ color: theme.palette.muted, fontSize: 16 }}>An animated story of your roads, music, and Memories. Included with JourneyDeck Plus.</Text>
        <Pressable accessibilityRole="button" onPress={nav.showUpgrade} style={{ padding: 18, backgroundColor: theme.palette.accent, borderRadius: 18 }}><Text style={{ color: theme.palette.onAccent, fontWeight: '800' }}>Explore Plus</Text></Pressable></>
        : error ? <><Text accessibilityRole="alert" style={{ color: theme.palette.muted }}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(n => n + 1)}><Text style={{ color: theme.palette.accent }}>Try again</Text></Pressable></>
          : !data ? <><ActivityIndicator color={theme.palette.accent} /><Text style={{ color: theme.palette.muted }}>Finding the moments that made your year…</Text></> : null}
    </View>
    {premium && data && getCurrentUser().id === owner && <YearOnRoadViewer visible data={data} appTheme={theme.id} premium={premium} soundAllowed={soundAllowed} soundUnavailableReason="Sound is paused while a journey is being recorded." onClose={close} onUnlock={nav.showUpgrade} />}
  </DetailScreenFrame>;
}
