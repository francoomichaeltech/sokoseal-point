// AudioWorklet modules must be loaded from a URL, so this source is served as a blob URL.
const SOURCE = `
class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor("sokoseal-capture", CaptureProcessor);
`;

export const CAPTURE_PROCESSOR = "sokoseal-capture";

// Registering the same processor twice rejects, so each context loads the module once.
const modules = new WeakMap<BaseAudioContext, Promise<void>>();

export function addCaptureModule(context: AudioContext): Promise<void> {
  let pending = modules.get(context);

  if (!pending) {
    const url = URL.createObjectURL(new Blob([SOURCE], { type: "text/javascript" }));
    pending = context.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
    pending.catch(() => modules.delete(context));
    modules.set(context, pending);
  }

  return pending;
}