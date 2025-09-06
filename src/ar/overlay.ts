
export type AspectInput = { aspect?: number, video?: HTMLVideoElement };

export function calcPlaneScale(input: AspectInput) {
  const aspect = input.aspect ?? (input.video ? input.video.videoWidth / input.video.videoHeight : 1);
  // Plane base size 1 x 1; scale width by aspect, keep height=1
  const width = aspect;
  const height = 1;
  return { width, height };
}
