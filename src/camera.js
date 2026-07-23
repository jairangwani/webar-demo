// camera.js — owns the live camera feed only. Nothing else knows how the
// pixels get here, so swapping to another source later touches just this file.

export async function startCamera(videoEl) {
  // Prefer the rear ("environment") camera — that's the one you point at the floor.
  const constraints = {
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  videoEl.srcObject = stream;

  // iOS needs an explicit play() call after the user gesture.
  await videoEl.play();

  // Report the real track settings so we can confirm which camera we actually got.
  const track = stream.getVideoTracks()[0];
  const settings = track ? track.getSettings() : {};
  return { stream, settings };
}
