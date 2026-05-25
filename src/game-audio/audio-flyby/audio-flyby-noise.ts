let flyLoopBuffer: AudioBuffer | null = null;

/** Shared loop buffer for all projectile fly voices. */
export function getFlybyNoiseBuffer(context: BaseAudioContext): AudioBuffer {
  if (flyLoopBuffer !== null) {
    return flyLoopBuffer;
  }

  const durationS = 0.28;
  const sampleCount = Math.floor(context.sampleRate * durationS);
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < sampleCount; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }

  flyLoopBuffer = buffer;
  return buffer;
}
