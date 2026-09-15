import { medallions } from './catalog.js';

const explorer = document.querySelector('.medallion-explorer');
const stage = document.querySelector('#medallion-stage');
const fallback = document.querySelector('#medallion-fallback');
const achievement = document.querySelector('#medallion-select');
const theme = document.querySelector('#medallion-theme');
const replay = document.querySelector('#medallion-replay');
const status = document.querySelector('#medallion-status');
const hint = document.querySelector('#medallion-hint');
const collection = document.querySelector('#medallion-collection');
const preference = matchMedia('(prefers-reduced-motion: reduce)');
let viewer = null;
let revision = 0;
let visible = false;
let started = false;
let rendererModule;
const imageUrl = (id, themeId, thumb = false) => `/assets/medallions/${id}-${themeId}${thumb ? '-thumb' : ''}.webp`;
const motion = () => ({ reduceMotion: preference.matches, active: visible && !document.hidden });

for (const medal of medallions) {
  achievement.add(new Option(medal.name, medal.id));
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'medallion-choice';
  button.dataset.id = medal.id;
  button.setAttribute('aria-label', `View ${medal.name}`);
  const image = document.createElement('img');
  image.alt = ''; image.width = image.height = 64; image.loading = 'lazy';
  const label = document.createElement('span'); label.textContent = medal.name;
  button.append(image, label);
  button.addEventListener('click', () => { achievement.value = medal.id; void show(); });
  collection.append(button);
}
achievement.value = 'soundtrack-100';
achievement.disabled = theme.disabled = false;

function updateCopy(medal, themeId) {
  explorer.dataset.theme = themeId;
  document.querySelector('#medallion-title').textContent = medal.name;
  document.querySelector('#medallion-group').textContent = `${medal.group} / ${String(medallions.indexOf(medal) + 1).padStart(2, '0')} of 10`;
  document.querySelector('#medallion-how').textContent = medal.how;
  document.querySelector('#medallion-why').textContent = medal.why;
  fallback.src = imageUrl(medal.id, themeId, true);
  fallback.alt = `${medal.name} in ${theme.selectedOptions[0].textContent}`;
  for (const button of collection.children) {
    button.setAttribute('aria-pressed', String(button.dataset.id === medal.id));
    button.querySelector('img').src = imageUrl(button.dataset.id, themeId, true);
  }
}

async function show() {
  const current = ++revision;
  const medal = medallions.find(item => item.id === achievement.value);
  const themeId = theme.value;
  viewer?.dispose(); viewer = null;
  stage.getAnimations().forEach(animation => animation.cancel());
  stage.classList.remove('is-ready');
  stage.replaceChildren();
  updateCopy(medal, themeId);
  fallback.hidden = true;
  status.textContent = `Preparing ${medal.name}…`;
  replay.disabled = true;
  explorer.setAttribute('aria-busy', 'true');
  const canvas = document.createElement('canvas');
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', `${medal.name}. Interactive 3D medallion.`);
  canvas.setAttribute('aria-describedby', 'medallion-hint');
  stage.append(canvas);
  const fail = () => {
    if (current !== revision) return;
    viewer?.dispose(); viewer = null;
    stage.classList.remove('is-ready'); fallback.hidden = false;
    status.textContent = 'Showing the artwork. The 3D view is unavailable on this device.';
    hint.textContent = 'Explore the collection and its four appearances below.';
    replay.disabled = false; explorer.setAttribute('aria-busy', 'false');
  };
  try {
    rendererModule ??= import('./viewer.js?v=medallions-1').catch(error => { rendererModule = null; throw error; });
    const { createMedallionViewer, frames } = await rendererModule;
    if (current !== revision) return;
    const next = await createMedallionViewer(canvas, imageUrl(medal.id, themeId), motion(), fail,
      { frame: frames[`${medal.id}-${themeId}`], name: medal.name });
    if (current !== revision) { next.dispose(); return; }
    viewer = next;
    viewer.setMotion(motion());
    stage.classList.add('is-ready');
    hint.textContent = 'Drag to turn. Use ← / → keys to rotate; Home or double-click to face front.';
    const dropFrames = preference.matches
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
        { transform: 'translateY(-440px) scale(.97)', offset: 0 },
        { transform: 'translateY(-116px) scale(.988)', offset: .38 },
        { transform: 'translateY(9px)', offset: .58 },
        { transform: 'translateY(-4px)', offset: .72 },
        { transform: 'translateY(1.5px)', offset: .84 },
        { transform: 'translateY(0)', offset: 1 },
      ];
    const animation = stage.animate(dropFrames, { duration: preference.matches ? 100 : 400, easing: 'linear' });
    await animation.finished.catch(() => {});
    if (current !== revision || !viewer) return;
    status.textContent = `${medal.name} · ${theme.selectedOptions[0].textContent}`;
    replay.disabled = false; explorer.setAttribute('aria-busy', 'false');
  } catch { fail(); }
}

achievement.addEventListener('change', () => { void show(); });
theme.addEventListener('change', () => { void show(); });
replay.addEventListener('click', () => { void show(); });
preference.addEventListener('change', () => {
  stage.getAnimations().forEach(animation => animation.finish());
  viewer?.setMotion(motion());
});
updateCopy(medallions.find(item => item.id === achievement.value), theme.value);
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible && !started) { started = true; void show(); }
    viewer?.setMotion(motion());
  });
  observer.observe(explorer);
} else { visible = started = true; void show(); }
window.addEventListener('pagehide', () => { ++revision; viewer?.dispose(); viewer = null; });
window.addEventListener('pageshow', event => { if (event.persisted && started) void show(); });
