// In-memory NVIDIA usage counter (this server session only).
// Trial quota is small (~25 requests), so routes expose it via /api/usage.

let nvidiaCalls = 0;
const since = new Date().toISOString();

export function countNvidiaCall() {
  nvidiaCalls += 1;
  if (nvidiaCalls > 15) {
    console.warn(
      `[IVLA] NVIDIA calls this session: ${nvidiaCalls} — trial quota is small, identical requests are cached.`
    );
  }
}

export function getUsage() {
  return { nvidiaCalls, since };
}
