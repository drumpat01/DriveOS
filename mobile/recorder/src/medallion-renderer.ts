import * as THREE from 'three';
import { COIN_RADIUS, createMedallionBody, createMedallionFace } from './medallion-geometry';
import { createMedallionStudio } from './medallion-studio';
import { DEFAULT_MEDALLION_FRAME, engravedNormals, smoothField, type MedallionFrame } from './medallion-surface';

export type MedallionMotion = { reduceMotion: boolean; active: boolean };
export type MedallionAppearance = { frame?: MedallionFrame; name?: string };
function canvas2d(size: number) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas unavailable');
  return { canvas, context };
}
function artworkTextures(image: HTMLImageElement, frame: MedallionFrame) {
  // Work above the source resolution so oblique minification has smoother
  // mip levels than the 1254px approved raster alone can provide.
  const size = 2048;
  const { canvas, context } = canvas2d(size);
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
  context.drawImage(image, frame.x * image.naturalWidth, frame.y * image.naturalHeight,
    frame.width * image.naturalWidth, frame.height * image.naturalHeight, 0, 0, size, size);
  const face = new THREE.CanvasTexture(canvas); face.colorSpace = THREE.SRGBColorSpace;
  const maskSize = 1024, sampled = canvas2d(maskSize);
  sampled.context.drawImage(canvas, 0, 0, maskSize, maskSize);
  const pixels = sampled.context.getImageData(0, 0, maskSize, maskSize).data;
  const gold = new Float32Array(maskSize * maskSize);
  for (let i = 0; i < gold.length; i++) {
    const r = pixels[i * 4], g = pixels[i * 4 + 1], b = pixels[i * 4 + 2];
    gold[i] = THREE.MathUtils.smoothstep(r - b, 28, 80)
      * THREE.MathUtils.smoothstep(g / Math.max(1, r), 0.57, 0.76) * THREE.MathUtils.smoothstep(r, 90, 170);
  }
  const smoothGold = smoothField(gold, maskSize, maskSize, 2, 2);
  const material = canvas2d(maskSize), normal = canvas2d(maskSize);
  const materialPixels = material.context.createImageData(maskSize, maskSize);
  for (let i = 0; i < gold.length; i++) {
    const metal = smoothGold[i];
    // Green=roughness, blue=metallic. Cream enamel remains non-metallic.
    materialPixels.data[i * 4] = Math.round((1 - metal) * 255);
    materialPixels.data[i * 4 + 1] = Math.round(255 * (0.44 - metal * 0.16));
    materialPixels.data[i * 4 + 2] = Math.round(255 * metal * 0.94); materialPixels.data[i * 4 + 3] = 255;
  }
  material.context.putImageData(materialPixels, 0, 0);
  const normalPixels = normal.context.createImageData(maskSize, maskSize);
  normalPixels.data.set(engravedNormals(smoothField(smoothGold, maskSize, maskSize, 3, 2), maskSize, maskSize));
  normal.context.putImageData(normalPixels, 0, 0);
  return { face, material: new THREE.CanvasTexture(material.canvas), normal: new THREE.CanvasTexture(normal.canvas) };
}
function reverseTextures(name: string) {
  // The reverse is simple line engraving; a smaller working map cuts its CPU
  // preparation nearly in half without softening the visible 380pt coin.
  const size = 768, art = canvas2d(size), ctx = art.context;
  ctx.scale(size / 1024, size / 1024);
  ctx.fillStyle = '#0b0b0b'; ctx.fillRect(0, 0, 1024, 1024);
  ctx.strokeStyle = '#d7d7d7'; ctx.fillStyle = '#d7d7d7'; ctx.lineWidth = 3;
  for (const radius of [400, 410]) { ctx.beginPath(); ctx.arc(512, 512, radius, 0, Math.PI * 2); ctx.stroke(); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '600 62px Georgia, serif';
  ctx.fillText('JOURNEYDECK', 512, 320, 670); ctx.lineWidth = 8; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(292, 567); ctx.lineTo(407, 435); ctx.lineTo(477, 501); ctx.lineTo(555, 409); ctx.lineTo(730, 567); ctx.stroke();
  ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(432, 650); ctx.quadraticCurveTo(590, 548, 512, 491); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(539, 650); ctx.quadraticCurveTo(640, 558, 536, 501); ctx.stroke();
  ctx.font = '500 31px Georgia, serif'; ctx.fillText(name.toUpperCase(), 512, 730, 650);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const pixels = ctx.getImageData(0, 0, size, size), field = new Float32Array(size * size);
  for (let i = 0; i < field.length; i++) field[i] = pixels.data[i * 4] / 255;
  const smooth = smoothField(field, size, size, 2, 2), normal = canvas2d(size), rough = canvas2d(size);
  const normals = normal.context.createImageData(size, size); normals.data.set(engravedNormals(smooth, size, size));
  normal.context.putImageData(normals, 0, 0);
  for (let i = 0; i < field.length; i++) {
    const value = Math.round(255 * (0.33 + smooth[i] * 0.12));
    pixels.data[i * 4] = pixels.data[i * 4 + 1] = pixels.data[i * 4 + 2] = value; pixels.data[i * 4 + 3] = 255;
  }
  rough.context.putImageData(pixels, 0, 0);
  return { normal: new THREE.CanvasTexture(normal.canvas), roughness: new THREE.CanvasTexture(rough.canvas) };
}

export async function createMedallionViewer(canvas: HTMLCanvasElement, artwork: string,
  initialMotion: MedallionMotion, onError: () => void, appearance: MedallionAppearance = {}) {
  const image = new Image(); image.src = artwork; await image.decode();
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  // The detail sheet contains one bounded canvas. A little supersampling makes
  // fine record grooves and engraved type hold together while the coin turns.
  renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1) * 1.5, 4));
  renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  const resources: Array<{ dispose: () => void }> = [];
  const own = <T extends { dispose: () => void }>(resource: T): T => { resources.push(resource); return resource; };
  let frame = 0, disposed = false;
  try {
    const scene = new THREE.Scene(), studio = createMedallionStudio(), pmrem = new THREE.PMREMGenerator(renderer);
    const environmentMap = own(pmrem.fromScene(studio.scene, 0.04));
    scene.environment = environmentMap.texture; scene.environmentIntensity = 0.85;
    studio.dispose(); pmrem.dispose();
    const camera = new THREE.OrthographicCamera(-1.1, 1.1, 1.1, -1.1, 0.1, 20); camera.position.z = 4;
    const coin = new THREE.Group(); scene.add(coin);
    // One exact center/axis for the body, face and reverse; no automatic startup tilt.
    const gold = own(new THREE.MeshStandardMaterial({ color: '#d9b66d', metalness: 1, roughness: 0.26, dithering: true }));
    coin.add(new THREE.Mesh(own(createMedallionBody()), gold));
    const textures = artworkTextures(image, appearance.frame ?? DEFAULT_MEDALLION_FRAME);
    own(textures.face); own(textures.material); own(textures.normal);
    for (const texture of Object.values(textures)) texture.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    const faceMaterial = own(new THREE.MeshPhysicalMaterial({ map: textures.face, color: '#ffffff',
      metalness: 1, metalnessMap: textures.material, roughness: 1, roughnessMap: textures.material,
      normalMap: textures.normal, normalScale: new THREE.Vector2(0.68, 0.68), clearcoat: 0.2,
      clearcoatMap: textures.material, clearcoatRoughness: 0.28, envMapIntensity: 0.9,
      specularIntensity: 0.65, dithering: true }));
    const face = new THREE.Mesh(own(createMedallionFace()), faceMaterial); face.name = 'coin-face'; coin.add(face);
    const reverse = reverseTextures(appearance.name ?? 'MEMORIES IN MOTION'); own(reverse.normal); own(reverse.roughness);
    const back = new THREE.Mesh(own(createMedallionFace()), own(new THREE.MeshStandardMaterial({
      color: '#d9b66d', metalness: 1, roughness: 1, roughnessMap: reverse.roughness,
      normalMap: reverse.normal, normalScale: new THREE.Vector2(0.85, 0.85), dithering: true })));
    back.rotation.y = Math.PI; back.name = 'engraved-reverse'; coin.add(back);
    const reedGeometry = own(new THREE.BoxGeometry(0.0025, 0.006, 0.070));
    const reeds = own(new THREE.InstancedMesh(reedGeometry, gold, 160)), matrix = new THREE.Matrix4();
    for (let i = 0; i < 160; i++) {
      const angle = i * Math.PI * 2 / 160;
      matrix.makeRotationZ(angle); matrix.setPosition(Math.cos(angle) * COIN_RADIUS, Math.sin(angle) * COIN_RADIUS, 0); reeds.setMatrixAt(i, matrix);
    }
    coin.add(reeds); scene.add(new THREE.HemisphereLight(0xffffff, 0xc5c9ce, 0.65));
    for (const [x, y, z, intensity] of [[-3, 4, 5, 1.25], [4, 1, 5, 0.8], [1, 3, -5, 1.1]]) {
      const light = new THREE.DirectionalLight(0xffffff, intensity); light.position.set(x, y, z); scene.add(light);
    }
    let motion = initialMotion, velocity = 0, pointer: number | null = null, lastTime = 0, previousX = 0, previousTime = 0;
    const render = () => { if (!disposed) renderer.render(scene, camera); };
    const active = () => motion.active && !document.hidden;
    const tick = (time: number) => {
      frame = 0;
      if (disposed || !active() || motion.reduceMotion || pointer !== null || Math.abs(velocity) < 0.008) return;
      const dt = Math.min((time - (lastTime || time)) / 1000, 0.04); lastTime = time;
      coin.rotation.y += velocity * dt; velocity *= Math.exp(-4.2 * dt); render(); frame = requestAnimationFrame(tick);
    };
    const release = () => {
      const held = pointer; pointer = null;
      if (held !== null && canvas.hasPointerCapture(held)) canvas.releasePointerCapture(held);
    };
    const syncMotion = () => {
      cancelAnimationFrame(frame); frame = 0; lastTime = 0;
      if (!active()) { velocity = 0; release(); return; }
      if (motion.reduceMotion) velocity = 0;
      render(); if (!motion.reduceMotion && Math.abs(velocity) >= 0.008) frame = requestAnimationFrame(tick);
    };
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect(); if (width <= 0 || height <= 0) return;
      renderer.setSize(width, height, false); const aspect = width / height, span = 1.1;
      camera.left = -span * Math.max(1, aspect); camera.right = -camera.left;
      camera.top = span / Math.min(1, aspect); camera.bottom = -camera.top; camera.updateProjectionMatrix(); render();
    };
    const down = (event: PointerEvent) => {
      if (pointer !== null || !active()) return;
      cancelAnimationFrame(frame); frame = 0; velocity = 0; pointer = event.pointerId;
      previousX = event.clientX; previousTime = event.timeStamp; canvas.setPointerCapture(pointer);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointer || !active()) return;
      const delta = (event.clientX - previousX) * 0.012, dt = Math.max(0.008, (event.timeStamp - previousTime) / 1000);
      coin.rotation.y += delta; velocity = motion.reduceMotion ? 0 : Math.max(-6, Math.min(6, delta / dt));
      previousX = event.clientX; previousTime = event.timeStamp; render();
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return;
      // Lifting after holding the coin still must not replay an old swipe.
      pointer = null;
      if (event.type !== 'pointerup' || motion.reduceMotion || event.timeStamp - previousTime > 120) velocity = 0;
      syncMotion();
    };
    const reset = () => { if (!active()) return; velocity = 0; coin.rotation.y = 0; syncMotion(); };
    const keyboard = (event: KeyboardEvent) => {
      if (!active()) return;
      if (event.key === 'Home') { event.preventDefault(); reset(); return; }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault(); velocity = 0; coin.rotation.y += event.key === 'ArrowLeft' ? -Math.PI / 6 : Math.PI / 6; render();
    };
    const lost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(frame); onError(); };
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('lostpointercapture', up); canvas.addEventListener('keydown', keyboard);
    canvas.addEventListener('dblclick', reset); canvas.addEventListener('webglcontextlost', lost); document.addEventListener('visibilitychange', syncMotion);
    resize(); syncMotion();
    return {
      capture() { render(); return canvas.toDataURL('image/png'); },
      setMotion(next: MedallionMotion) { motion = next; syncMotion(); },
      dispose() {
        disposed = true; cancelAnimationFrame(frame); observer.disconnect();
        canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
        canvas.removeEventListener('lostpointercapture', up); canvas.removeEventListener('keydown', keyboard);
        canvas.removeEventListener('dblclick', reset); canvas.removeEventListener('webglcontextlost', lost);
        document.removeEventListener('visibilitychange', syncMotion); release(); resources.forEach(resource => resource.dispose()); renderer.dispose();
      },
    };
  } catch (error) {
    disposed = true; cancelAnimationFrame(frame); resources.forEach(resource => resource.dispose()); renderer.dispose(); throw error;
  }
}
