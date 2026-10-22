/** All pages, including housing and guides, check for a worker update on entry. */
async function updateServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const base = new URL(import.meta.env.BASE_URL || '/', location.href);
  try {
    // Do not install an offline worker for development; only migrate an old one.
    if (import.meta.env.DEV && !await navigator.serviceWorker.getRegistration(base.href)) return;
    const registration = await navigator.serviceWorker.register(new URL('sw.js', base).href, {
      scope: base.pathname,
      updateViaCache: 'none',
    });
    await registration.update();
  } catch (error) {
    console.warn('[SW] Update check failed:', error);
  }
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'complete') void updateServiceWorker();
  else window.addEventListener('load', () => void updateServiceWorker(), { once: true });
}
