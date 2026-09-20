import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useMotionPreferences } from './motion';

export function useCoreMotion(screenActive = true) {
  const motion = useMotionPreferences();
  const [reduceTransparency, setReduceTransparency] = useState(true);

  useEffect(() => {
    let mounted = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', value => {
      changed = true;
      setReduceTransparency(value);
    });
    void AccessibilityInfo.isReduceTransparencyEnabled().then(value => {
      if (mounted && !changed) setReduceTransparency(value);
    }).catch(() => undefined);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  return useMemo(() => ({
    ...motion,
    active: motion.isAppActive && screenActive,
    animate: motion.isAppActive && screenActive && !motion.reduceMotion,
    transparentLayers: !reduceTransparency,
    reduceTransparency,
  }), [motion, reduceTransparency, screenActive]);
}
