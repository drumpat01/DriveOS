'use dom';

import { useEffect, useRef } from 'react';
import type { DOMProps } from 'expo/dom';
import { createMedallionViewer } from './medallion-renderer';
import type { MedallionFrame } from './medallion-surface';

type Props = {
  artwork: string;
  name: string;
  frame: MedallionFrame;
  reduceMotion: boolean;
  active: boolean;
  waitForPaint?: boolean;
  onReady: () => Promise<void>;
  onError: () => Promise<void>;
  dom?: DOMProps;
};

export default function MedallionDOM({ artwork, name, frame, reduceMotion, active, waitForPaint = false, onReady, onError }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewer = useRef<Awaited<ReturnType<typeof createMedallionViewer>> | null>(null);
  const latest = useRef({ reduceMotion, active, onReady, onError });
  latest.current = { reduceMotion, active, onReady, onError };
  useEffect(() => {
    let alive = true;
    let readinessFrame = 0;
    if (!canvas.current) return;
    const fail = () => { if (alive) void latest.current.onError(); };
    void createMedallionViewer(canvas.current, artwork, latest.current, fail, { frame, name }).then(result => {
      if (!alive) { result.dispose(); return; }
      viewer.current = result;
      result.setMotion(latest.current);
      if (!waitForPaint) { void latest.current.onReady(); return; }
      // iPad's native cover stays opaque until a nonzero canvas has rendered
      // and the browser has had a paint opportunity. Do not expose startup frames.
      const prepareReveal = () => {
        if (!alive) return;
        const bounds = canvas.current?.getBoundingClientRect();
        if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
          readinessFrame = requestAnimationFrame(prepareReveal); return;
        }
        result.setMotion(latest.current);
        readinessFrame = requestAnimationFrame(() => { if (alive) void latest.current.onReady(); });
      };
      readinessFrame = requestAnimationFrame(prepareReveal);
    }).catch(fail);
    return () => { alive = false; if (readinessFrame) cancelAnimationFrame(readinessFrame); viewer.current?.dispose(); viewer.current = null; };
  }, [artwork, name, frame.x, frame.y, frame.width, frame.height, waitForPaint]);
  useEffect(() => { viewer.current?.setMotion({ reduceMotion, active }); }, [reduceMotion, active]);
  return <>
    <style>{'html,body,#root{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}*{box-sizing:border-box}'}</style>
    <canvas ref={canvas} tabIndex={0} role="img" aria-label={`${name} medallion. Drag to rotate, or use left and right arrow keys.`}
      style={{ display: 'block', width: '100vw', height: '100vh', touchAction: 'none', outline: 'none' }} />
  </>;
}
