// Tracker facade with dynamic MindAR wiring (falls back to mock for tests)
import type { ArtworkId, AssetUrls } from '../routing/id';

export interface Anchor {
  onTargetFound?: () => void;
  onTargetLost?: () => void;
}
export class MockAnchor implements Anchor {
  onTargetFound?: () => void;
  onTargetLost?: () => void;
}

export class Tracker {
  anchor: Anchor = new MockAnchor();
  private mindarThree: any;
  private scene: any;
  private camera: any;
  private renderer: any;
  private running = false;
  private videoPlanes: Record<number, any> = {};
  private anchors: Record<number, any> = {};
  private artworkTargetMap: Record<number, ArtworkId> = {};
  private targetDimensions: Record<number, { width: number; height: number }> = {};

  constructor(private opts: { 
    container: HTMLElement; 
    imageTargetSrc: string;
    artworkVideos: Record<ArtworkId, HTMLVideoElement>;
  }) {
    // Create mapping from target index to artwork ID
    const artworkIds = Object.keys(this.opts.artworkVideos) as ArtworkId[];
    artworkIds.forEach((artworkId, index) => {
      this.artworkTargetMap[index] = artworkId;
    });
    console.log('[Tracker] Target mapping:', this.artworkTargetMap);
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  private async startCameraFallback() {
    console.log('[Tracker] Starting camera-only fallback mode');
    
    // Create a basic camera display
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;';
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      video.srcObject = stream;
      this.opts.container.appendChild(video);
      this.running = true;
      
      // Mock target detection after 3 seconds for demo
      setTimeout(() => {
        console.log('[Tracker] Mock target found (camera fallback)');
        this.anchor.onTargetFound?.();
      }, 3000);
      
      console.log('[Tracker] Camera fallback started successfully');
    } catch (e) {
      console.error('[Tracker] Camera fallback failed:', e);
      throw e;
    }
  }

  private createVideoPlane(anchor: any, targetIndex: number) {
    try {
      const artworkId = this.artworkTargetMap[targetIndex];
      console.log(`[Tracker] Creating video plane for target ${targetIndex} (${artworkId})`);
      const THREE = (window as any).THREE;
      
      // Get the video element for this artwork
      const video = this.opts.artworkVideos[artworkId];
      if (!video) {
        console.error(`[Tracker] Could not find video element for ${artworkId}`);
        return;
      }

      // Lazily read target dimensions from controller if available
      try {
        if (!this.targetDimensions || Object.keys(this.targetDimensions).length === 0) {
          const dims: any[] | undefined = this.mindarThree?.controller?.dimensions;
          if (Array.isArray(dims)) {
            dims.forEach((d: any, idx: number) => {
              if (Array.isArray(d) && d.length >= 2) {
                const w = Number(d[0]);
                const h = Number(d[1]);
                if (isFinite(w) && isFinite(h) && w > 0 && h > 0) {
                  this.targetDimensions[idx] = { width: w, height: h };
                }
              }
            });
            console.log('[Tracker] Target dimensions (lazy):', this.targetDimensions);
          }
        }
      } catch (e) {
        console.log('[Tracker] Could not read target dimensions lazily:', e);
      }
      
      console.log(`[Tracker] Video element found for ${artworkId}:`, {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        currentTime: video.currentTime,
        readyState: video.readyState,
        src: video.src
      });
      
      // Create video texture
      const videoTexture = new THREE.VideoTexture(video);
      videoTexture.minFilter = THREE.LinearFilter;
      videoTexture.magFilter = THREE.LinearFilter;
      videoTexture.format = THREE.RGBAFormat;
      
      // Base geometry 1x1; scale Y to match aspect (robust if video sizes arrive later)
      const geometry = new THREE.PlaneGeometry(1, 1);
      const material = new THREE.MeshBasicMaterial({ 
        map: videoTexture,
        side: THREE.DoubleSide, // Visible from both sides
        transparent: true
      });
      
      const videoPlane = new THREE.Mesh(geometry, material);
      const dimsForTarget = this.targetDimensions[targetIndex];
      const applyAspect = (w: number, h: number) => {
        if (w && h) {
          const aspect = h / w; // height over width
          videoPlane.scale.set(1, aspect, 1);
          console.log(`[Tracker] Applied aspect scale for ${artworkId}: ${w}x${h} -> scaleY=${aspect}`);
        }
      };
      if (dimsForTarget) {
        applyAspect(dimsForTarget.width, dimsForTarget.height);
      } else if (video.videoWidth && video.videoHeight) {
        applyAspect(video.videoWidth, video.videoHeight);
      } else {
        // Update when video metadata becomes available
        const onMeta = () => {
          video.removeEventListener('loadedmetadata', onMeta);
          applyAspect(video.videoWidth, video.videoHeight);
        };
        video.addEventListener('loadedmetadata', onMeta, { once: true });
      }
      
      // Position the plane just in front of the target to avoid z-fighting
      videoPlane.position.set(0, 0, 0.001);
      
      anchor.group.add(videoPlane);
      this.videoPlanes[targetIndex] = videoPlane;
      
      console.log(`[Tracker] Video plane created for ${artworkId} (target ${targetIndex}) and added to anchor`);
      console.log('[Tracker] Plane geometry:', geometry);
      console.log('[Tracker] Video texture:', videoTexture);
    } catch (e) {
      console.error('[Tracker] Failed to create video plane:', e);
    }
  }

  async start() {
    if (this.running) return;
    console.log('[Tracker] Starting tracker...');
    console.log('[Tracker] Container:', this.opts.container);
    console.log('[Tracker] Image target src:', this.opts.imageTargetSrc);
    console.log('[Tracker] Video:', this.opts.video);
    
    try {
      console.log('[Tracker] Loading modules via script tags...');
      
      // Add a checkpoint to see if we get this far
      console.log('[Tracker] Checkpoint 1: Starting module loading');
      
      // Load Three.js via script tag first
      if (!(window as any).THREE) {
        console.log('[Tracker] Loading Three.js...');
        await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js');
        console.log('[Tracker] Three.js loaded globally');
      }
      
      // Load MindAR - try different versions
      if (!(window as any).MINDAR) {
        console.log('[Tracker] Loading MindAR...');
        const mindArUrls = [
          'https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-image-three.prod.js',
          'https://unpkg.com/mind-ar@1.2.2/dist/mindar-image-three.prod.js',
          'https://cdn.jsdelivr.net/npm/mind-ar@1.1.0/dist/mindar-image-three.prod.js',
          'https://unpkg.com/mind-ar@1.1.0/dist/mindar-image-three.prod.js'
        ];
        
        let loaded = false;
        for (const url of mindArUrls) {
          try {
            console.log(`[Tracker] Trying MindAR from: ${url}`);
            await this.loadScript(url);
            await new Promise(resolve => setTimeout(resolve, 300));
            if ((window as any).MINDAR) {
              console.log(`[Tracker] MindAR loaded successfully from: ${url}`);
              loaded = true;
              break;
            }
          } catch (e) {
            console.log(`[Tracker] Failed to load from ${url}:`, e);
          }
        }
        
        if (!loaded) {
          console.log('[Tracker] All MindAR URLs failed, checking what we have...');
        }
      }
      
      console.log('[Tracker] Checkpoint 2: All modules loaded');
      console.log('[Tracker] Available globals:', Object.keys(window).filter(k => k.includes('MIND') || k.includes('THREE')));
      
      try {
        console.log('[Tracker] window.MINDAR:', (window as any).MINDAR);
      } catch (e) {
        console.log('[Tracker] Error accessing window.MINDAR:', e);
      }
      
      try {
        console.log('[Tracker] window.THREE:', (window as any).THREE);
      } catch (e) {
        console.log('[Tracker] Error accessing window.THREE:', e);
      }
      
      console.log('[Tracker] Checkpoint 3: About to analyze MINDAR structure');
      
      // IMMEDIATE detailed logging when MINDAR exists
      if ((window as any).MINDAR) {
        try {
          console.log('[Tracker] MINDAR object found, analyzing structure...');
          const mindAR = (window as any).MINDAR;
          console.log('[Tracker] MINDAR keys:', Object.keys(mindAR));
          console.log('[Tracker] MINDAR type:', typeof mindAR);
          
          for (const key of Object.keys(mindAR)) {
            try {
              const value = mindAR[key];
              console.log(`[Tracker] MINDAR.${key} (${typeof value}):`, value);
              
              if (value && typeof value === 'object') {
                console.log(`[Tracker] MINDAR.${key} keys:`, Object.keys(value));
                
                // Check specifically for MindARThree
                if (value.MindARThree) {
                  console.log(`[Tracker] Found MindARThree at MINDAR.${key}.MindARThree:`, value.MindARThree);
                }
              }
            } catch (e) {
              console.log(`[Tracker] Error analyzing MINDAR.${key}:`, e);
            }
          }
        } catch (e) {
          console.log('[Tracker] Error analyzing MINDAR structure:', e);
        }
      } else {
        console.log('[Tracker] MINDAR not found in window object');
      }
      
      console.log('[Tracker] Checkpoint 4: Finished MINDAR analysis');
      console.log('[Tracker] Checkpoint 5: Starting MindARThree access');
      
      // Check different possible structures with better error handling
      let MindARThree;
      const mindar = (window as any).MINDAR;
      
      console.log('[Tracker] Attempting to access MindARThree constructor...');
      
      try {
        // Try different access patterns
        if (mindar && mindar.IMAGE) {
          console.log('[Tracker] Found MINDAR.IMAGE, checking for MindARThree...');
          const imageModule = mindar.IMAGE;
          console.log('[Tracker] IMAGE module keys:', Object.keys(imageModule));
          
          if (imageModule.MindARThree) {
            console.log('[Tracker] Found MINDAR.IMAGE.MindARThree');
            MindARThree = imageModule.MindARThree;
          } else {
            console.log('[Tracker] MindARThree not found in IMAGE module');
          }
        }
        
        // Fallback attempts
        if (!MindARThree && mindar && mindar.MindARThree) {
          console.log('[Tracker] Found MINDAR.MindARThree');
          MindARThree = mindar.MindARThree;
        }
        
        if (!MindARThree && (window as any).MindARThree) {
          console.log('[Tracker] Found global MindARThree');
          MindARThree = (window as any).MindARThree;
        }
        
        if (!MindARThree) {
          console.log('[Tracker] No MindARThree constructor found, using camera fallback');
          await this.startCameraFallback();
          return;
        }
        
      } catch (e) {
        console.log('[Tracker] Error accessing MindARThree:', e);
        await this.startCameraFallback();
        return;
      }
      console.log('[Tracker] MindARThree constructor:', MindARThree);
      console.log('[Tracker] Creating MindARThree instance...');

      try {
        console.log(`[Tracker] Creating MindARThree with target: ${this.opts.imageTargetSrc}`);
        this.mindarThree = new MindARThree({
          container: this.opts.container,
          imageTargetSrc: this.opts.imageTargetSrc,
        });
        console.log('[Tracker] MindARThree instance created successfully');
        console.log(`[Tracker] Confirmed imageTargetSrc: ${this.opts.imageTargetSrc}`);
      } catch (e) {
        console.error('[Tracker] MindARThree constructor failed:', e);
        throw e;
      }

      try {
        const { renderer, scene, camera } = this.mindarThree;
        this.renderer = renderer; this.scene = scene; this.camera = camera;
        console.log('[Tracker] Got renderer, scene, camera from MindARThree');
      } catch (e) {
        console.error('[Tracker] Failed to destructure MindARThree properties:', e);
        throw e;
      }

      try {
        // Create anchors for all artworks
        const artworkIds = Object.keys(this.opts.artworkVideos) as ArtworkId[];
        console.log(`[Tracker] Setting up ${artworkIds.length} anchors for multi-target detection`);
        
        for (let targetIndex = 0; targetIndex < artworkIds.length; targetIndex++) {
          const artworkId = this.artworkTargetMap[targetIndex];
          const realAnchor = this.mindarThree.addAnchor(targetIndex);
          console.log(`[Tracker] Added anchor for target index ${targetIndex} (${artworkId})`);
          this.anchors[targetIndex] = realAnchor;
          
          realAnchor.onTargetFound = () => {
            console.log(`[Tracker] Target found! Index: ${targetIndex}, Artwork: ${artworkId}`);
            
            // Make sure the anchor group is visible
            realAnchor.group.visible = true;
            console.log(`[Tracker] Set anchor group visible to true for ${artworkId}`);
            
            // Create video plane for this specific target
            this.createVideoPlane(realAnchor, targetIndex);
            
          // Start playing the corresponding video
          const video = this.opts.artworkVideos[artworkId];
          if (video) {
            // Ensure src is assigned lazily from data-src before loading
            if (!video.src) {
              const ds = (video as HTMLElement).getAttribute('data-src');
              if (ds) {
                console.log(`[Tracker] Setting src for ${artworkId} from data-src: ${ds}`);
                video.src = ds;
              }
            }

            video.hidden = false;
            console.log(`[Tracker] Video readyState for ${artworkId}: ${video.readyState}`);
            
            // Try to play immediately if possible, otherwise wait
            const attemptPlay = () => {
                video.play()
                  .then(() => {
                    console.log(`[Tracker] ✅ Successfully playing video for ${artworkId}`);
                  })
                  .catch(e => {
                    console.error(`[Tracker] ❌ Failed to play video for ${artworkId}:`, e);
                    console.error(`[Tracker] Video error details:`, video.error);
                  });
              };
              
              // Helpful diagnostics on iOS before deciding how to wait
              try {
                const support = video.canPlayType('video/mp4; codecs="avc1.4d401f, mp4a.40.2"');
                console.log(`[Tracker] canPlayType (H.264/AAC) for ${artworkId}: ${support || 'unknown'}`);
              } catch {}

              if (video.readyState >= 1) {
                // Video has at least metadata loaded
                // Prefer canplay event for iOS reliability
                const onCanPlay = () => {
                  video.removeEventListener('canplay', onCanPlay);
                  attemptPlay();
                };
                video.addEventListener('canplay', onCanPlay, { once: true });
                // Also attempt immediately; canplay will be a no-op if already ready
                attemptPlay();
              } else {
                // Video not ready, try to load it first
                console.log(`[Tracker] Video not ready for ${artworkId}, trying to load...`);
                video.load();
                const onCanPlay = () => {
                  video.removeEventListener('canplay', onCanPlay);
                  console.log(`[Tracker] Video loaded for ${artworkId}, attempting to play...`);
                  attemptPlay();
                };
                
                const onError = (e: any) => {
                  try { video.removeEventListener('error', onError); } catch {}
                  console.error(`[Tracker] ❌ Video loading failed for ${artworkId}:`, e);
                };
                
                video.addEventListener('canplay', onCanPlay, { once: true });
                video.addEventListener('error', onError, { once: true });
              }
            }
            
            this.anchor.onTargetFound?.();
          };
          
          realAnchor.onTargetLost = () => {
            console.log(`[Tracker] Target lost! Index: ${targetIndex}, Artwork: ${artworkId}`);
            
            // Hide the anchor group
            realAnchor.group.visible = false;
            console.log(`[Tracker] Set anchor group visible to false for ${artworkId}`);
            
            // Remove video plane
            if (this.videoPlanes[targetIndex]) {
              realAnchor.group.remove(this.videoPlanes[targetIndex]);
              delete this.videoPlanes[targetIndex];
            }
            
            // Pause the video
            const video = this.opts.artworkVideos[artworkId];
            if (video) {
              video.pause();
              video.hidden = true;
              console.log(`[Tracker] Paused video for ${artworkId}`);
            }
            
            this.anchor.onTargetLost?.();
          };
        }
        console.log(`[Tracker] Set up ${artworkIds.length} anchor event handlers`);
      } catch (e) {
        console.error('[Tracker] Failed to add anchors or set handlers:', e);
        throw e;
      }

      try {
        console.log('[Tracker] Starting MindAR engine...');
        await this.mindarThree.start();
        this.running = true;
        console.log('[Tracker] MindAR engine started, setting up render loop');
        
        // Try to get more info about what target was actually loaded
        try {
          console.log('[Tracker] Checking loaded target info...');
          if (this.mindarThree.controller) {
            console.log('[Tracker] Controller exists:', !!this.mindarThree.controller);
            console.log('[Tracker] Target info:', this.mindarThree.controller.targetInfos || 'No target info available');
          }
        } catch (e) {
          console.log('[Tracker] Could not get target info:', e);
        }
        this.renderer.setAnimationLoop(() => { this.renderer.render(this.scene, this.camera); });
        
        // Fix the camera video and renderer z-index ordering
        console.log('[Tracker] Fixing layer ordering...');
        
        // Set camera video to background
        const videos = this.opts.container.getElementsByTagName('video');
        for (let i = 0; i < videos.length; i++) {
          const video = videos[i];
          console.log(`[Tracker] Found video element ${i}, current z-index:`, video.style.zIndex);
          video.style.zIndex = '0'; // Camera feed at z=0
          video.style.width = '100%';
          video.style.height = '100%';
          video.style.objectFit = 'cover';
          console.log(`[Tracker] Updated video ${i} z-index to 0`);
        }
        
        // Set Three.js renderer to be in front of camera
        if (this.renderer && this.renderer.domElement) {
          this.renderer.domElement.style.zIndex = '10'; // AR overlays in front
          console.log('[Tracker] Set Three.js renderer z-index to 10');
        }
        
        // Also set CSS renderer if it exists
        if (this.mindarThree.cssRenderer && this.mindarThree.cssRenderer.domElement) {
          this.mindarThree.cssRenderer.domElement.style.zIndex = '11';
          console.log('[Tracker] Set CSS renderer z-index to 11');
        }
        
        console.log('[Tracker] MindAR engine started successfully');
      } catch (e) {
        console.error('[Tracker] Failed to start MindAR engine:', e);
        throw e;
      }
    } catch (e) {
      // In tests/jsdom this is expected; stays in mock mode.
      console.warn('[Tracker] MindAR initialization failed:', e);
      console.log('[Tracker] Falling back to camera-only mode due to error');
      await this.startCameraFallback();
    }
  }

  stop() {
    console.log('[Tracker] Stopping tracker...');
    
    try { 
      this.renderer?.setAnimationLoop(null); 
      console.log('[Tracker] Cleared animation loop');
    } catch (e) {
      console.error('[Tracker] Error clearing animation loop:', e);
    }
    
    try { 
      if (this.mindarThree?.stop) {
        this.mindarThree.stop(); 
        console.log('[Tracker] Stopped MindAR engine');
      }
    } catch (e) {
      console.error('[Tracker] Error stopping MindAR:', e);
    }
    
    // Clear the container of MindAR elements
    try {
      const container = this.opts.container;
      // Remove Three.js canvas elements added by MindAR
      const canvases = container.querySelectorAll('canvas');
      canvases.forEach(canvas => {
        if (canvas.parentNode === container) {
          container.removeChild(canvas);
          console.log('[Tracker] Removed canvas element');
        }
      });
      
      // Remove MindAR video elements
      const videos = container.querySelectorAll('video');
      videos.forEach(video => {
        if (video !== this.opts.video && video.parentNode === container) {
          container.removeChild(video);
          console.log('[Tracker] Removed MindAR video element');
        }
      });
    } catch (e) {
      console.error('[Tracker] Error cleaning up DOM elements:', e);
    }
    
    this.running = false;
    this.mindarThree = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.videoPlanes = {};
    this.anchors = {};
    
    console.log('[Tracker] Tracker stopped and cleaned up');
  }
}
