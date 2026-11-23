const depths = { beatrix: 2, foreground: 4, 'white-light': 6, 'background-slimes': 8, 'distant-slimes': 10, bubbles: 12 };
// The light effects are not wrapped in a [data-motion] layer, so they get their own depth.
const lightEffectDepth = 7;
const tiltRange = 18;
let tiltPermissionGranted = false;

function isMobileAgent() {
  const { userAgent, maxTouchPoints } = navigator;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) ||
    (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

export function mountHomeParallax(hero: HTMLElement) {
  const targets = [
    ...Object.entries(depths).flatMap(([group, depth]) =>
      [...hero.querySelectorAll<HTMLElement>(`[data-motion="${group}"] > .home-key-art-layer`)]
        .map(layer => ({ layer, depth })),
    ),
    ...[...hero.querySelectorAll<HTMLElement>('.home-light-effect-field')]
      .map(layer => ({ layer, depth: lightEffectDepth })),
  ];
  const controller = new AbortController();
  const options = { passive: true, signal: controller.signal };
  const control = hero.querySelector<HTMLElement>('.home-tilt-control');
  const button = control?.querySelector('button');
  const status = control?.querySelector<HTMLElement>('[role="status"]');
  let frame: number | undefined;
  let nextX = 0;
  let nextY = 0;

  for (const { layer } of targets) layer.dataset.parallax = '';

  function move(x: number, y: number) {
    const length = Math.max(1, Math.hypot(x, y));
    nextX = x / length;
    nextY = y / length;
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

  if (!isMobileAgent()) {
    window.addEventListener('pointermove', event => {
      if (event.pointerType === 'mouse') {
        move(2 * event.clientX / innerWidth - 1, 2 * event.clientY / innerHeight - 1);
      }
    }, options);
    document.documentElement.addEventListener('pointerleave', () => move(0, 0), options);
    window.addEventListener('blur', () => move(0, 0), options);
  } else if (window.isSecureContext && window.DeviceOrientationEvent) {
    const orientationEvent = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<PermissionState>;
    };
    const requestTiltPermission = orientationEvent.requestPermission?.bind(orientationEvent);
    let neutral: { beta: number; gamma: number; angle: number } | undefined;

    function tilt({ beta, gamma }: DeviceOrientationEvent) {
      if (beta === null || gamma === null || !Number.isFinite(beta) || !Number.isFinite(gamma)) return;

      const angle = screen.orientation?.angle ?? window.orientation ?? 0;
      if (!neutral || neutral.angle !== angle) {
        neutral = { beta, gamma, angle };
        move(0, 0);
        return;
      }

      const radians = angle * Math.PI / 180;
      const x = (gamma - neutral.gamma) / tiltRange;
      const y = (((beta - neutral.beta + 540) % 360) - 180) / tiltRange;
      move(x * Math.cos(radians) + y * Math.sin(radians), y * Math.cos(radians) - x * Math.sin(radians));
    }

    if (!requestTiltPermission || tiltPermissionGranted) {
      window.addEventListener('deviceorientation', tilt, options);
    } else if (control && button && status) {
      control.hidden = false;
      button.addEventListener('click', async () => {
        button.disabled = true;
        let granted = false;
        try {
          granted = await requestTiltPermission() === 'granted';
        } catch {
          // Sensor permissions can be blocked by the browser.
        }
        if (granted) tiltPermissionGranted = true;
        if (controller.signal.aborted) return;

        button.disabled = granted;
        status.textContent = granted ? '倾斜动效已开启' : '倾斜动效未获授权';
        if (granted) window.addEventListener('deviceorientation', tilt, options);
      }, { signal: controller.signal });
    }
  }

  return () => {
    controller.abort();
    if (frame !== undefined) cancelAnimationFrame(frame);
    for (const { layer } of targets) {
      delete layer.dataset.parallax;
      layer.style.removeProperty('transform');
    }
    if (control) control.hidden = true;
    if (button) button.disabled = false;
    if (status) status.textContent = '';
  };
}
