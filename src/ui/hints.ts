
export type HintKey = 'point-camera' | 'hold-steady' | 'reduce-glare' | 'rotate-portrait';

export function hintText(key: HintKey): string {
  switch (key) {
    case 'point-camera': return 'Point your camera at the artwork';
    case 'hold-steady': return 'Hold steady for a moment…';
    case 'reduce-glare': return 'Try reducing glare or moving closer';
    case 'rotate-portrait': return 'Rotate your phone to portrait';
  }
}
