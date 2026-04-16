'use client';

export interface VirtualMicReceiver {
  track: MediaStreamTrack;
  stop: () => Promise<void>;
}

const WORKLET_PROCESSOR_CODE = `
class PCMVirtualMicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.offset = 0;
    this.totalSamples = 0;
    this.maxBufferedSamples = 48000 * 2; // tối đa khoảng 2 giây ở 48kHz

    this.port.onmessage = (event) => {
      const data = event.data;
      if (!(data instanceof Float32Array)) return;

      this.queue.push(data);
      this.totalSamples += data.length;

      // Nếu buffer bị quá dài thì bỏ bớt chunk cũ để giảm trễ
      while (this.totalSamples > this.maxBufferedSamples && this.queue.length > 1) {
        const dropped = this.queue.shift();
        this.totalSamples -= dropped.length;
        this.offset = 0;
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    const channel = output[0];
    const framesNeeded = channel.length;

    let written = 0;

    while (written < framesNeeded && this.queue.length > 0) {
      const chunk = this.queue[0];
      const available = chunk.length - this.offset;
      const toCopy = Math.min(framesNeeded - written, available);

      for (let i = 0; i < toCopy; i++) {
        channel[written + i] = chunk[this.offset + i];
      }

      written += toCopy;
      this.offset += toCopy;
      this.totalSamples -= toCopy;

      if (this.offset >= chunk.length) {
        this.queue.shift();
        this.offset = 0;
      }
    }

    // thiếu dữ liệu thì fill silence
    if (written < framesNeeded) {
      channel.fill(0, written);
    }

    return true;
  }
}

registerProcessor('pcm-virtual-mic-processor', PCMVirtualMicProcessor);
`;

function pcm16ToFloat32(pcm16: Int16Array): Float32Array {
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = pcm16[i] / 32768;
  }
  return float32;
}

export async function startVirtualMicReceiver(
  wsUrl: string,
  sampleRate = 16000,
): Promise<VirtualMicReceiver> {
  const audioContext = new AudioContext({
    sampleRate,
    latencyHint: 'interactive',
  });

  let workletNode: AudioWorkletNode | null = null;
  let destination: MediaStreamAudioDestinationNode | null = null;
  let ws: WebSocket | null = null;
  let track: MediaStreamTrack | null = null;

  try {
    const blob = new Blob([WORKLET_PROCESSOR_CODE], {
      type: 'application/javascript',
    });
    const blobUrl = URL.createObjectURL(blob);

    try {
      await audioContext.audioWorklet.addModule(blobUrl);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }

    workletNode = new AudioWorkletNode(audioContext, 'pcm-virtual-mic-processor');
    destination = audioContext.createMediaStreamDestination();
    workletNode.connect(destination);

    await audioContext.resume();

    ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(`Kết nối virtual mic websocket bị timeout: ${wsUrl}`));
      }, 5000);

      ws!.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve();
      };

      ws!.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`Không thể kết nối virtual mic websocket: ${wsUrl}`));
      };
    });

    ws.onmessage = (event) => {
      const data = event.data;

      if (!(data instanceof ArrayBuffer)) return;
      if (!workletNode) return;

      const pcm16 = new Int16Array(data);
      const float32 = pcm16ToFloat32(pcm16);
      workletNode.port.postMessage(float32, [float32.buffer]);
    };

    ws.onclose = () => {
      // Không throw ở đây, track vẫn còn nhưng sẽ dần phát silence
      console.warn('Virtual mic websocket closed:', wsUrl);
    };

    track = destination.stream.getAudioTracks()[0];
    if (!track) {
      throw new Error('Không tạo được audio track cho virtual mic');
    }

    return {
      track,
      stop: async () => {
        try {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        } catch (error) {
          console.error('Error while closing virtual mic websocket:', error);
        }

        try {
          workletNode?.disconnect();
        } catch (error) {
          console.error('Error while disconnecting worklet node:', error);
        }

        try {
          track?.stop();
        } catch (error) {
          console.error('Error while stopping virtual mic track:', error);
        }

        try {
          if (audioContext.state !== 'closed') {
            await audioContext.close();
          }
        } catch (error) {
          console.error('Error while closing audio context:', error);
        }
      },
    };
  } catch (error) {
    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    } catch {}

    try {
      workletNode?.disconnect();
    } catch {}

    try {
      track?.stop();
    } catch {}

    try {
      if (audioContext.state !== 'closed') {
        await audioContext.close();
      }
    } catch {}

    throw error;
  }
}