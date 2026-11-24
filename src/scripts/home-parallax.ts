const depths = { beatrix: 2, foreground: 4, 'white-light': 6, 'background-slimes': 8, 'distant-slimes': 10, bubbles: 12 };
// The light effects are not wrapped in a [data-motion] layer, so they get their own depth.
const lightEffectDepth = 7;
const tiltRange = 18;
const tiltStorageKey = 'ranching-handbook-tilt';

type Mode = 'pointer' | 'tilt';
type TiltState = 'unknown' | 'granted' | 'denied' | 'unsupported' | 'insecure';

type OrientationEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<PermissionState>;
};

// Mobile devices are assumed to be driven by the gyroscope until a mouse shows up, and desktop
// machines are assumed to follow the pointer until a finger shows up. Whichever input the visitor
// actually uses flips the mode at runtime.
function prefersTilt() {
  const { userAgent, maxTouchPoints } = navigator;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) ||
    (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

function tiltPreference() {
  try {
    return localStorage.getItem(tiltStorageKey) !== 'off';
  } catch {
    return true;
  }
}

// Motion sensors are only exposed to secure contexts. On plain http:// the browser never shows a
// prompt at all, which looks like a silent failure, so that case gets its own state and a hint.
function motionBlockedByContext() {
  return typeof window.isSecureContext === 'boolean' && !window.isSecureContext;
}

// Asked on load, regardless of the user agent. iOS only answers inside a gesture, so a rejection
// here is retried when the visitor first touches the page.
async function askTiltPermission(): Promise<TiltState> {
  const api = window.DeviceOrientationEvent as OrientationEvent | undefined;
  if (motionBlockedByContext()) return 'insecure';
  // No sensor API at all (most desktops): leave the switch untouched instead of greying it out.
  if (!api) return 'unsupported';
  if (typeof api.requestPermission !== 'function') return 'granted';

  try {
    return await api.requestPermission() === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export function mountHomeParallax(hero: HTMLElement) {
  const targets = [
    ...Object.entries(depths).flatMap(([group, depth]) => {
      return [...hero.querySelectorAll<HTMLElement>(`[data-motion="${group}"] > .home-key-art-layer`)]
        .map(layer => ({ layer, depth }));
    }),
    ...[...hero.querySelectorAll<HTMLElement>('.home-light-effect-field')]
      .map(layer => ({ layer, depth: lightEffectDepth })),
  ];
  const controller = new AbortController();
  const options = { passive: true, signal: controller.signal };
  const toggle = document.querySelector<HTMLInputElement>('#home-theme input[name="site-tilt"]');
  let frame: number | undefined;
  let nextX = 0;
  let nextY = 0;
  let mode: Mode = prefersTilt() ? 'tilt' : 'pointer';
  let tiltState: TiltState = 'unknown';
  let tiltEnabled = tiltPreference();
  let neutral: { beta: number; gamma: number; angle: number } | undefined;

  for (const { layer } of targets) layer.dataset.parallax = '';

  function paint() {
    (window as any).__tiltState = tiltState;
    (window as any).__tiltMode = mode;
    frame ??= requestAnimationFrame(() => {
      frame = undefined;
      for (const { layer, depth } of targets) {
        const angle = depth * .065;
        layer.style.transform = nextX || nextY
          ? `perspective(160cqw) translate(${nextX * depth}px, ${nextY * depth}px) rotateX(${nextY * angle}deg) rotateY(${-nextX * angle}deg)`
          : '';
      }
    });
  }

  function move(x: number, y: number) {
    // 保留到中心的距离（否则恒为单位向量，位移永远一样大）。
    nextX = Math.max(-1, Math.min(1, x));
    nextY = Math.max(-1, Math.min(1, y));
    paint();
  }

  function settle() {
    nextX = 0;
    nextY = 0;
    paint();
  }

  function syncToggle() {
    const blocked = tiltState === 'denied';
    const insecure = tiltState === 'insecure';
    if (toggle) {
      toggle.checked = tiltEnabled && !blocked;
      toggle.disabled = blocked;
    }
    const label = toggle?.closest('label');
    label?.toggleAttribute('data-unavailable', blocked);
    if (label && insecure) label.title = '需要通过 HTTPS 访问才能启用陀螺仪';
    else label?.removeAttribute('title');
  }

  function tilt({ alpha, beta, gamma }: DeviceOrientationEvent) {
    (window as any).__tiltSample = [alpha, beta, gamma]
      .map(value => (typeof value === 'number' ? value.toFixed(0) : '-'))
      .join(',');
    if (!tiltEnabled || mode !== 'tilt') return;
    if (beta === null || gamma === null || !Number.isFinite(beta) || !Number.isFinite(gamma)) return;

    const angle = screen.orientation?.angle ?? window.orientation ?? 0;
    if (!neutral || neutral.angle !== angle) {
      neutral = { beta, gamma, angle };
      settle();
      return;
    }

    const radians = angle * Math.PI / 180;
    const x = (gamma - neutral.gamma) / tiltRange;
    const y = (((beta - neutral.beta + 540) % 360) - 180) / tiltRange;
    move(x * Math.cos(radians) + y * Math.sin(radians), y * Math.cos(radians) - x * Math.sin(radians));
  }

  function enableTilt() {
    if (tiltState !== 'granted') return;
    window.addEventListener('deviceorientation', tilt, options);
  }

  function requestTilt() {
    askTiltPermission().then(state => {
      if (controller.signal.aborted) return;
      tiltState = state;
      if (state === 'granted') enableTilt();
      syncToggle();
    });
  }

  // iOS quietly ignores a prompt outside of a gesture, and some builds leave the returned promise
  // pending forever instead of rejecting. Arm a one-shot gesture retry up front so the first tap or
  // scroll always produces a real request.
  const orientationApi = window.DeviceOrientationEvent as OrientationEvent | undefined;
  if (typeof orientationApi?.requestPermission === 'function' && !motionBlockedByContext()) {
    const retry = () => {
      window.removeEventListener('pointerdown', retry);
      window.removeEventListener('touchstart', retry);
      if (controller.signal.aborted || tiltState === 'granted') return;
      askTiltPermission().then(next => {
        if (controller.signal.aborted) return;
        tiltState = next;
        if (next === 'granted') enableTilt();
        syncToggle();
      });
    };
    window.addEventListener('pointerdown', retry, { passive: true, signal: controller.signal });
    window.addEventListener('touchstart', retry, { passive: true, signal: controller.signal });
  }

  window.addEventListener('pointermove', event => {
    if (!tiltEnabled || event.pointerType !== 'mouse') return;
    if (mode !== 'pointer') {
      mode = 'pointer';
      neutral = undefined;
      settle();
    }
    move(2 * event.clientX / innerWidth - 1, 2 * event.clientY / innerHeight - 1);
  }, options);

  for (const type of ['touchstart', 'pointerdown'] as const) {
    window.addEventListener(type, event => {
      if (type === 'pointerdown' && (event as PointerEvent).pointerType === 'mouse') return;
      if (mode !== 'tilt') {
        mode = 'tilt';
        neutral = undefined;
        settle();
      }
    }, options);
  }

  // The pointer leaving the page keeps the scene where it was: the cursor often leaves only to
  // reach the browser chrome (or another display) and comes straight back, and the snap to flat
  // in between read as the effect fighting the visitor. Losing window focus still settles, so a
  // tilted scene never sits frozen behind another app.
  window.addEventListener('blur', settle, options);

  toggle?.addEventListener('change', () => {
    tiltEnabled = toggle.checked;
    try {
      localStorage.setItem(tiltStorageKey, tiltEnabled ? 'on' : 'off');
    } catch {
      // Keep the choice for this page.
    }
    if (!tiltEnabled) {
      neutral = undefined;
      settle();
    } else if (tiltState === 'denied') {
      requestTilt();
    } else if (tiltState === 'granted') {
      mode = 'tilt';
    }
  }, options);

  requestTilt();
  syncToggle();

  return () => {
    controller.abort();
    if (frame !== undefined) cancelAnimationFrame(frame);
    for (const { layer } of targets) {
      delete layer.dataset.parallax;
      layer.style.removeProperty('transform');
    }
  };
}
