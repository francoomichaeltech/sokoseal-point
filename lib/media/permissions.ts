type Device = "camera" | "microphone";

const storageKey = (device: Device) => `sokoseal.${device}.granted`;

export function markGranted(device: Device) {
  sessionStorage.setItem(storageKey(device), "1");
}

// True if the device can be opened without asking the user again.
export async function wasGranted(device: Device): Promise<boolean> {
  try {
    const { state } = await navigator.permissions.query({ name: device as PermissionName });
    if (state !== "prompt") return state === "granted";
  } catch {
    // Firefox does not support querying camera or microphone permissions.
  }
  return sessionStorage.getItem(storageKey(device)) === "1";
}