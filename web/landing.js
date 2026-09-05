const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
const reveals = Array.from(document.querySelectorAll('.reveal'));
let observer;
let frame = 0;
const parallax = Array.from(document.querySelectorAll('[data-parallax]'));
const scrollStory = document.querySelector('.scroll-story');
const reel = document.querySelector('.reel');

function paint() {
  frame = 0;
  if (preference.matches) return;
  const height = window.innerHeight;
  parallax.forEach(element => {
    const rect = element.parentElement.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > height) return;
    const distance = Math.max(-180, Math.min(180, -rect.top * Number(element.dataset.parallax)));
    element.style.transform = `translate3d(0,${distance}px,0)`;
  });
  if (scrollStory) {
    const rect = scrollStory.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (height * .8 - rect.top) / Math.max(1, rect.height)));
    scrollStory.style.setProperty('--route-offset', String(1 - progress));
  }
  if (reel && window.innerWidth > 760) {
    const rect = reel.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (height * .8 - rect.top) / Math.max(1, rect.height)));
    const track = reel.querySelector('.reel-track');
    const overflow = Math.max(0, track.scrollWidth - document.documentElement.clientWidth);
    reel.style.setProperty('--reel-x', `${-progress * overflow}px`);
  } else if (reel) reel.style.removeProperty('--reel-x');
}
function schedule() { if (!frame && !preference.matches) frame = window.requestAnimationFrame(paint); }
function configureMotion() {
  observer?.disconnect();
  document.body.classList.toggle('motion-on', !preference.matches);
  if (preference.matches) {
    parallax.forEach(element => element.style.removeProperty('transform'));
    scrollStory?.style.removeProperty('--route-offset');
    reel?.style.removeProperty('--reel-x');
    return;
  }
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    }), { threshold: .08 });
    reveals.forEach(element => observer.observe(element));
  } else reveals.forEach(element => element.classList.add('visible'));
  schedule();
}
window.addEventListener('scroll', schedule, { passive: true });
window.addEventListener('resize', schedule, { passive: true });
preference.addEventListener('change', configureMotion);
configureMotion();
document.querySelectorAll('.theme-toggle').forEach(button => {
  button.addEventListener('click', () => {
    const preview = button.closest('.device-stage').querySelector('[data-theme-preview]');
    const light = preview.classList.toggle('light');
    button.setAttribute('aria-pressed', String(light));
    button.textContent = light ? 'Preview dark mode ☾' : 'Preview light mode ☀';
  });
});
