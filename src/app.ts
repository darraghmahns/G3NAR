import { resolveAllAssets, ARTWORKS, type ArtworkId } from './routing/id';
import { startCamera, stopCamera } from './ar/camera';
import { Tracker } from './ar/tracker';

const root = document.getElementById('app')!;

// Resolve all asset URLs (centralized), including correct video extensions
const ASSETS = resolveAllAssets();

// Prebuild the hidden <video> elements with the resolved /media paths
const videosMarkup = ARTWORKS
  .map(artwork => {
    const videoSrc = ASSETS[artwork].video;
    // Use data-src for lazy-load; don't set src upfront
    return `<video id="video-${artwork}" playsinline webkit-playsinline muted hidden preload="none" data-src="${videoSrc}" style="position:absolute;top:-9999px;left:-9999px;width:1px;height:1px;"></video>`;
  })
  .join('');

root.innerHTML = `
  <div id="ar-container" style="position:fixed;left:0;top:0;right:0;bottom:0;overflow:hidden;background:#000;"></div>
  <div id="media-preload" hidden>${videosMarkup}</div>
  <div id="tap-overlay" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:white;background:rgba(0,0,0,0.85);font-size:18px;z-index:1001;">Tap to start AR</div>
`;

const fallbackDiv = document.getElementById('media-preload')!;
const tapOverlay = document.getElementById('tap-overlay') as HTMLDivElement;
const arContainer = document.getElementById('ar-container') as HTMLDivElement;

// Get all video elements for each artwork
const artworkVideos: Record<ArtworkId, HTMLVideoElement> = {} as any;
for (const artwork of ARTWORKS) {
  const video = document.getElementById(`video-${artwork}`) as HTMLVideoElement;
  if (video) {
    video.muted = true;
    video.setAttribute('muted', '');
    // Avoid preloading large assets; we set src on demand
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous'; // Help with CORS issues
    artworkVideos[artwork] = video;
  }
}

let tracker: Tracker | null = null;

// Fit container to VisualViewport (iOS address bar/toolbar safe-area)
function fitToVisualViewport() {
  const vv = (window as any).visualViewport;
  if (!vv) return;
  const w = Math.round(vv.width);
  const h = Math.round(vv.height);
  const x = Math.round(vv.offsetLeft);
  const y = Math.round(vv.offsetTop);
  arContainer.style.width = w + 'px';
  arContainer.style.height = h + 'px';
  arContainer.style.transform = `translate(${x}px, ${y}px)`;
  arContainer.style.transformOrigin = 'top left';
}
fitToVisualViewport();
const vv = (window as any).visualViewport;
if (vv) {
  vv.addEventListener('resize', fitToVisualViewport);
  vv.addEventListener('scroll', fitToVisualViewport);
}
window.addEventListener('orientationchange', () => setTimeout(fitToVisualViewport, 300));

// No debug text element; full-screen AR UI

// Lazy-load: availability will be logged when target is found and src is set
console.log('Testing video availability...');

// Add video loading error handling for all videos
for (const [artworkId, video] of Object.entries(artworkVideos)) {
  video.addEventListener('loadstart', () => console.log(`Video loading started: ${artworkId}`));
  video.addEventListener('loadeddata', () => console.log(`Video data loaded: ${artworkId}`));
  video.addEventListener('error', async (e) => {
    console.error(`Video loading error for ${artworkId}:`, e);
    console.error(`Video error details for ${artworkId}:`, video.error);
    // Dev-only: probe HTTP status to distinguish 404 vs decode failures
    if (import.meta.env.DEV) {
      try {
        const url = video.currentSrc || video.getAttribute('data-src') || '';
        if (url) {
          const resp = await fetch(url, { method: 'HEAD' });
          console.warn(`HEAD ${url} -> ${resp.status} ${resp.statusText} [${resp.headers.get('content-type')}]`);
        }
      } catch (err) {
        console.warn('HEAD check failed:', err);
      }
    }
  });
  video.addEventListener('stalled', () => {
    console.warn(`Video loading stalled: ${artworkId}`);
  });
}

// Log important info for debugging
console.log('Current URL:', location.pathname);
console.log('Available artworks:', ARTWORKS);
console.log('User agent:', navigator.userAgent);
console.log('Is HTTPS:', location.protocol === 'https:');
console.log('Has getUserMedia:', !!navigator.mediaDevices?.getUserMedia);

// Add global error handler
window.addEventListener('error', (e) => {
  console.error('Global error:', e);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e);
});

let stream: MediaStream | undefined;

// No idle fallback UI; we auto-start AR

async function startAR() {
  console.log('Starting AR flow...');
  try {
    // Try to get camera permission first
    console.log('Requesting camera permission...');
    stream = await startCamera({ facingMode: 'environment' });
    console.log('Camera permission granted, stream:', stream);
    
    // Create multi-target tracker using the compiled targets.mind file
    tracker = new Tracker({
      container: arContainer,
      imageTargetSrc: '/targets/targets.mind',
      artworkVideos: artworkVideos
    });
    
    console.log('Starting multi-target tracker...');
    await tracker.start();
    console.log('Multi-target tracker started successfully');
    tapOverlay.style.display = 'none';
    // Ensure any camera <video> covers container
    const vids = arContainer.getElementsByTagName('video');
    for (let i = 0; i < vids.length; i++) {
      const v = vids[i];
      v.style.position = 'absolute';
      v.style.top = '0';
      v.style.left = '0';
      v.style.width = '100%';
      v.style.height = '100%';
      v.style.objectFit = 'cover';
      v.style.zIndex = '0';
    }
  } catch (e: any) {
    console.error('AR start error:', e);
    // Show a minimal tap-to-start overlay if permission blocked or any error
    tapOverlay.style.display = 'flex';
  }
}

// Attempt to auto-start on load
startAR();

// Also allow tap to retry start (for iOS permission)
tapOverlay.addEventListener('click', () => startAR());

// Optional: expose a stop function for debugging
(window as any).stopAR = () => {
  console.log('Stopping AR...');
  if (tracker) { tracker.stop(); tracker = null; }
  for (const video of Object.values(artworkVideos)) { video.pause(); video.hidden = true; }
  if (stream) { stopCamera(stream); stream = undefined; }
  tapOverlay.style.display = 'flex';
};

// Minimal UI: page autostarts AR and shows full-screen camera/AR
