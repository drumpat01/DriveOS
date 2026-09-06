import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { router, useIsFocused, useLocalSearchParams, useNavigation, type NativeStackNavigationProp } from 'expo-router';

export type JourneyCardAction = 'edit' | 'share';
let requestSequence = 0;

export function openJourneyCardAction(id: string, action: JourneyCardAction) {
  // A fresh route owns the action, its local-first read, and membership gate.
  router.push({ pathname: '/journey/[id]', params: {
    id, cardAction: action, cardActionRequest: `${Date.now()}-${++requestSequence}`,
  } });
}

export function useJourneyCardAction(ready: boolean, onEdit: () => void, onShare: () => void) {
  const { cardAction, cardActionRequest } = useLocalSearchParams<{ cardAction?: string; cardActionRequest?: string }>();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const focused = useIsFocused();
  const [settled, setSettled] = useState(() => navigation.getState().index === 0);
  const consumed = useRef<string | null>(null);
  useLayoutEffect(() => {
    const start = navigation.addListener('transitionStart', () => setSettled(false));
    const end = navigation.addListener('transitionEnd', event => { if (!event.data.closing) setSettled(true); });
    return () => { start(); end(); };
  }, [navigation]);
  useEffect(() => {
    if (!ready || !focused || !settled || !cardActionRequest || consumed.current === cardActionRequest) return;
    if (cardAction !== 'edit' && cardAction !== 'share') return;
    consumed.current = cardActionRequest;
    // Present only once, after both the local read and native push complete.
    // Refreshes and returning from another screen must not reopen a sheet.
    if (cardAction === 'edit') onEdit(); else onShare();
  }, [ready, focused, settled, cardAction, cardActionRequest, onEdit, onShare]);
}
