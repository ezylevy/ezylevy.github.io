import lamejs from 'lamejs';

function floatToInt16(floatArray) {
  const int16 = new Int16Array(floatArray.length);
  for (let i = 0; i < floatArray.length; i += 1) {
    const s = Math.max(-1, Math.min(1, floatArray[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

function audioBufferToMp3(audioBuffer, kbps = 320) {
  const channels = Math.min(audioBuffer.numberOfChannels, 2);
  const sampleRate = audioBuffer.sampleRate;

  const left = floatToInt16(audioBuffer.getChannelData(0));
  const right =
    channels === 2 ? floatToInt16(audioBuffer.getChannelData(1)) : left;

  const encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
  const blockSize = 1152;
  const mp3Chunks = [];

  for (let i = 0; i < left.length; i += blockSize) {
    const leftChunk = left.subarray(i, i + blockSize);
    const rightChunk = right.subarray(i, i + blockSize);

    const mp3buf =
      channels === 2
        ? encoder.encodeBuffer(leftChunk, rightChunk)
        : encoder.encodeBuffer(leftChunk);

    if (mp3buf.length > 0) {
      mp3Chunks.push(new Uint8Array(mp3buf));
    }
  }

  const end = encoder.flush();
  if (end.length > 0) {
    mp3Chunks.push(new Uint8Array(end));
  }

  return new Blob(mp3Chunks, { type: 'audio/mp3' });
}

export async function exportSegmentToMp3({
  audioBuffer,
  startSec,
  endSec,
  name,
  kbps = 320,
}) {
  if (!audioBuffer) {
    throw new Error('No audio loaded');
  }

  if (startSec >= endSec) {
    throw new Error('Invalid segment range');
  }

  const startSample = Math.max(0, Math.floor(startSec * audioBuffer.sampleRate));
  const endSample = Math.min(
    audioBuffer.length,
    Math.ceil(endSec * audioBuffer.sampleRate)
  );

  if (startSample >= endSample) {
    throw new Error('Segment contains no audio');
  }

  const length = endSample - startSample;
  const channels = audioBuffer.numberOfChannels;

  const sliced = new AudioBuffer({
    length,
    numberOfChannels: channels,
    sampleRate: audioBuffer.sampleRate,
  });

  for (let ch = 0; ch < channels; ch += 1) {
    const source = audioBuffer.getChannelData(ch).subarray(startSample, endSample);
    sliced.copyToChannel(source, ch, 0);
  }

  const blob = audioBufferToMp3(sliced, kbps);
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.mp3`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
