const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const features = [
  { label: 'HOME', title: 'A good day starts here.', description: 'Start a journey with one tap. Your route, time, and distance come together in a journal that’s yours to keep.' },
  { label: 'SOUNDTRACKS', title: 'Hear the memory again.', description: 'The songs you played belong to the story, too. Connect Apple Music to keep a soundtrack alongside your journeys.' },
  { label: 'MEMORIES', title: 'Keep the days that stay with you.', description: 'Bring a trip’s journeys into one Memory. Find matching photos, add a note, and turn a weekend away into a chapter you can come back to.' },
  { label: 'MEDALLIONS', title: 'Little milestones. Lasting keepsakes.', description: 'A ten-song drive earns Long Play. Discover the medallions behind your milestones, then give the real 3D collection a spin below.' },
  { label: 'STATISTICS', title: 'Look back. See how far you’ve come.', description: 'Your miles, journeys, driving time, and song plays, together at a glance. Explore your recent history and open Atlas for a deeper perspective.' },
];

const tour = document.querySelector('.tour');
const slides = [...tour.querySelectorAll('.tour-slide')];
const dots = [...tour.querySelectorAll('[data-slide]')];
const caption = tour.querySelector('.tour-caption');
const visual = tour.querySelector('.tour-visual');
const playButton = tour.querySelector('.tour-play');
let activeIndex = 0;
let displayedIndex = 0;
let transitionRevision = 0;
let playing = false;
let timer;
let tourVisible = true;

function stopTimer() { clearTimeout(timer); }
function scheduleTour() {
  stopTimer();
  if (playing && tourVisible && !document.hidden && !motionPreference.matches) {
    timer = setTimeout(() => { void showSlide(activeIndex + 1); }, 6500);
  }
}

async function showSlide(index, manual = false) {
  const nextIndex = (index + slides.length) % slides.length;
  if (manual) setPlaying(false);
  if (nextIndex === activeIndex) { scheduleTour(); return; }
  const currentRevision = ++transitionRevision;
  const direction = index < activeIndex ? -1 : 1;
  activeIndex = nextIndex;
  const current = slides[nextIndex];
  stopTimer();
  const nextImage = current.querySelector('img');
  nextImage.loading = 'eager';
  // Keep the current page of the deck visible while a new screenshot downloads.
  await nextImage.decode().catch(() => {});
  if (currentRevision !== transitionRevision) return;
  const previousIndex = displayedIndex;
  displayedIndex = nextIndex;
  for (const slide of slides) {
    slide.getAnimations().forEach(animation => animation.cancel());
    slide.hidden = slide !== current;
    slide.removeAttribute('aria-hidden');
    slide.style.removeProperty('z-index');
    slide.classList.toggle('is-current', slide === current);
  }
  const feature = features[nextIndex];
  const ordinal = String(nextIndex + 1).padStart(2, '0');
  document.querySelector('#feature-label').textContent = `${ordinal} / ${feature.label}`;
  document.querySelector('#feature-title').textContent = feature.title;
  document.querySelector('#feature-description').textContent = feature.description;
  document.querySelector('#tour-count').textContent = ordinal;
  dots.forEach((dot, dotIndex) => dot.setAttribute('aria-pressed', String(dotIndex === nextIndex)));
  caption.getAnimations().forEach(animation => animation.cancel());
  stopTimer();
  if (!motionPreference.matches && previousIndex !== nextIndex) {
    const previous = slides[previousIndex];
    previous.hidden = false;
    previous.setAttribute('aria-hidden', 'true');
    current.style.zIndex = '2';
    const outgoing = previous.animate([
      { transform: 'rotateY(0deg)', opacity: 1, filter: 'brightness(1)' },
      { transform: `rotateY(${-direction * 68}deg)`, opacity: 0, filter: 'brightness(.5)' },
    ], { duration: 580, easing: 'cubic-bezier(.22,.7,.18,1)' });
    const incoming = current.animate([
      { transform: `translateX(${direction * 45}px) rotateY(${direction * 55}deg)`, opacity: .12, filter: 'brightness(.65)' },
      { transform: 'translateX(0) rotateY(0deg)', opacity: 1, filter: 'brightness(1)' },
    ], { duration: 780, easing: 'cubic-bezier(.16,.8,.2,1)' });
    caption.animate([{ opacity: .2, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 650, easing: 'cubic-bezier(.16,.8,.2,1)' });
    await Promise.allSettled([outgoing.finished, incoming.finished]);
    if (currentRevision !== transitionRevision) return;
    previous.hidden = true;
    previous.removeAttribute('aria-hidden');
    current.style.removeProperty('z-index');
  }
  // Warm only the next screen; the other images remain lazy.
  slides[(nextIndex + 1) % slides.length].querySelector('img').loading = 'eager';
  scheduleTour();
}

function setPlaying(value) {
  playing = value && !motionPreference.matches;
  playButton.textContent = playing ? 'Pause tour' : 'Play tour';
  playButton.setAttribute('aria-pressed', String(playing));
  // Manual changes are announced; optional autoplay does not interrupt a screen reader.
  caption.setAttribute('aria-live', playing ? 'off' : 'polite');
  scheduleTour();
}

tour.querySelector('.tour-controls').hidden = false;
dots.forEach(dot => dot.addEventListener('click', () => { void showSlide(Number(dot.dataset.slide), true); }));
tour.querySelector('#tour-prev').addEventListener('click', () => { void showSlide(activeIndex - 1, true); });
tour.querySelector('#tour-next').addEventListener('click', () => { void showSlide(activeIndex + 1, true); });
playButton.addEventListener('click', () => { setPlaying(!playing); });
visual.addEventListener('keydown', event => {
  const destination = { ArrowLeft: activeIndex - 1, ArrowRight: activeIndex + 1, Home: 0, End: slides.length - 1 }[event.key];
  if (destination === undefined) return;
  event.preventDefault();
  void showSlide(destination, true);
});
let pointerStart;
visual.addEventListener('pointerdown', event => {
  if (event.isPrimary && event.button === 0) {
    pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    visual.setPointerCapture(event.pointerId);
  }
});
visual.addEventListener('pointercancel', () => { pointerStart = undefined; });
visual.addEventListener('pointerup', event => {
  if (!pointerStart || pointerStart.id !== event.pointerId) return;
  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  pointerStart = undefined;
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) void showSlide(activeIndex + (dx < 0 ? 1 : -1), true);
});
visual.addEventListener('dragstart', event => event.preventDefault());
tour.addEventListener('focusin', event => { if (event.target !== playButton) setPlaying(false); });
document.addEventListener('visibilitychange', scheduleTour);

const revealElements = [...document.querySelectorAll('[data-reveal]')];
let revealObserver;
if ('IntersectionObserver' in window) {
  document.documentElement.classList.add('motion-ready');
  document.querySelectorAll('.feature-grid, .device-grid').forEach(group => {
    [...group.children].forEach((child, index) => child.style.setProperty('--reveal-delay', `${index * 85}ms`));
  });
  revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  }, { threshold: .12, rootMargin: '0px 0px -20px 0px' });
  revealElements.forEach(element => revealObserver.observe(element));
  const tourObserver = new IntersectionObserver(entries => { tourVisible = entries[0].isIntersecting; scheduleTour(); }, { threshold: .2 });
  tourObserver.observe(tour);
}

const scenic = document.querySelector('.scenic-break');
const deck = document.querySelector('.phone-stack');
const routePaths = [...document.querySelectorAll('.draw-route')].map(element => ({ element, length: element.getTotalLength() }));
routePaths.forEach(({ element, length }) => element.style.setProperty('--route-length', length));
let frame = 0;
function updateScroll() {
  frame = 0;
  if (motionPreference.matches) return;
  const height = innerHeight;
  const heroRect = tour.getBoundingClientRect();
  if (heroRect.bottom > 0 && heroRect.top < height) deck.style.setProperty('--deck-y', `${Math.max(-25, Math.min(18, -heroRect.top * .045))}px`);
  const scenicRect = scenic.getBoundingClientRect();
  if (scenicRect.bottom > 0 && scenicRect.top < height) scenic.style.setProperty('--parallax-y', `${(height / 2 - scenicRect.top - scenicRect.height / 2) * .1}px`);
  for (const { element, length } of routePaths) {
    const rect = element.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, (height * .95 - rect.top) / (height * .45)));
    element.style.setProperty('--route-offset', (1 - progress) * length);
  }
}
function requestScrollUpdate() { if (!frame && !motionPreference.matches) frame = requestAnimationFrame(updateScroll); }
window.addEventListener('scroll', requestScrollUpdate, { passive: true });
window.addEventListener('resize', requestScrollUpdate, { passive: true });
function applyMotionPreference() {
  if (motionPreference.matches) {
    setPlaying(false);
    playButton.hidden = true;
    revealElements.forEach(element => element.classList.add('is-visible'));
    slides.forEach(slide => slide.getAnimations().forEach(animation => animation.finish()));
    caption.getAnimations().forEach(animation => animation.finish());
    cancelAnimationFrame(frame); frame = 0;
  } else { playButton.hidden = false; requestScrollUpdate(); }
}
motionPreference.addEventListener('change', applyMotionPreference);
applyMotionPreference();
window.addEventListener('pagehide', () => { stopTimer(); cancelAnimationFrame(frame); frame = 0; });
window.addEventListener('pageshow', () => { scheduleTour(); requestScrollUpdate(); });
