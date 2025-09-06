
export type AssetUrls = { mind: string; video: string; meta: string };

// All available artworks in the system
export const ARTWORKS = [
  'autopoiesis',
  'dollar-sign', 
  'dreaming',
  'metatation',
  'on-and-off',
  'red-movement',
  'singularity',
  'sleepless-nights',
  'ventus'
] as const;

export type ArtworkId = typeof ARTWORKS[number];

// Some assets have non-standard extensions (e.g., metatation uses .MP4)
const VIDEO_EXT: Record<ArtworkId, string> = {
  'autopoiesis': '.mp4',
  'dollar-sign': '.mp4',
  'dreaming': '.mp4',
  'metatation': '.MP4',
  'on-and-off': '.mp4',
  'red-movement': '.mp4',
  'singularity': '.mp4',
  'sleepless-nights': '.mp4',
  'ventus': '.mp4'
};

export function resolveAssetUrls(artworkId: ArtworkId): AssetUrls {
  const ext = VIDEO_EXT[artworkId] ?? '.mp4';
  return {
    mind: `/targets/${artworkId}.mind`,
    video: `/media/${artworkId}${ext}`,
    meta: `/meta/${artworkId}.json`
  };
}

export function resolveAllAssets(): Record<ArtworkId, AssetUrls> {
  const assets: Record<string, AssetUrls> = {};
  for (const artwork of ARTWORKS) {
    assets[artwork] = resolveAssetUrls(artwork);
  }
  return assets as Record<ArtworkId, AssetUrls>;
}

export function getIdFromPath(pathname: string): ArtworkId {
  const m = pathname.match(/\/art\/(.+)$/);
  const id = m ? m[1] : 'autopoiesis';
  return ARTWORKS.includes(id as ArtworkId) ? (id as ArtworkId) : 'autopoiesis';
}
