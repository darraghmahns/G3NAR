
export type CameraStartOptions = { facingMode?: 'environment' | 'user' };
export async function startCamera(opts: CameraStartOptions = {}): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('getUserMedia not supported');
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: opts.facingMode ?? 'environment' },
      audio: false
    });
    return stream;
  } catch (e: any) {
    // normalize common errors
    if (e && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')) {
      throw new Error('camera-permission-denied');
    }
    if (e && (e.name === 'NotFoundError' || e.name === 'OverconstrainedError')) {
      throw new Error('camera-not-found');
    }
    throw e;
  }
}

export function stopCamera(stream?: MediaStream) {
  stream?.getTracks().forEach(t => t.stop());
}
