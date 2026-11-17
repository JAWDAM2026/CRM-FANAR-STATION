export type BrowserNotificationPermissionState = NotificationPermission | "unsupported";

export function getBrowserNotificationPermission(): BrowserNotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return window.Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermissionState> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  try {
    const result = await window.Notification.requestPermission();
    return result;
  } catch {
    return window.Notification.permission || "denied";
  }
}

export function playNotificationChime(): void {
  if (typeof window === "undefined") return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, startOffset: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + startOffset);

      gain.gain.setValueAtTime(0.0001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.08, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    playTone(587.33, 0, 0.16);
    playTone(880, 0.13, 0.24);

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 650);
  } catch {
    // Ignore autoplay restrictions before user gesture
  }
}

export function sendBrowserNotification(options: {
  title: string;
  body: string;
  tag: string;
  onClick?: () => void;
}): Notification | null {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return null;
  }
  if (window.Notification.permission !== "granted") {
    return null;
  }

  try {
    const notification = new window.Notification(options.title, {
      body: options.body,
      tag: options.tag,
      dir: "rtl",
      lang: "ar",
      icon: "/favicon.ico",
    });

    notification.onclick = () => {
      try {
        window.focus();
      } catch {
        // Ignore window focus restrictions
      }
      notification.close();
      options.onClick?.();
    };

    return notification;
  } catch {
    return null;
  }
}
