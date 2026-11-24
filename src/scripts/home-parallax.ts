const depths = { beatrix: 2, foreground: 4, 'white-light': 6, 'background-slimes': 8, 'distant-slimes': 10, bubbles: 12 };
// The light effects are not wrapped in a [data-motion] layer, so they get their own depth.
const lightEffectDepth = 7;
// Degrees of rotation that take the scene from flat to fully deflected. A wrist tilts much further
// than a mouse travels, so this is deliberately looser than the pointer's reach.
const tiltRange = 24;
// Rotation around the resting pose that is ignored outright: a hand that is merely alive should not
// drag the scene around.
const tiltDeadZone = 2.5;
// How long the tilt takes to catch up with the device, as an exponential time constant.
const tiltEase = 130;
// Number of samples averaged to find the pose the visitor is holding the device in. Calibrating on a
// single sample made the zero point as noisy as the sensor itself.
const tiltRestSamples = 10;
// Rotations this far outside the range are treated as a new way of holding the device rather than a
// deliberate tilt, and the resting pose quietly follows them -- all the way, so the scene eases back
// to level under the new grip. Without that, changing posture leaves the scene pinned at full
// deflection with nothing left to answer, until the switch is toggled off and on again.
const tiltAdoptMs = 900;
const tiltAdoptSpan = (tiltRange + tiltDeadZone) * 1.4;
// Below this much gravity on the screen plane the device is (almost) flat, where "how far back is it
// tipped" has no answer. Samples are skipped instead of snapping.
const tiltFlatness = 0.35;
// A granted permission is not a working sensor: some devices (or a sensor claimed by another app)
// hand out the permission and then send nothing. Giving up after this long keeps the switch honest.
const tiltProbeMs = 1500;
const tiltStorageKey = 'ranching-handbook-tilt';

type Mode = 'pointer' | 'tilt';
type TiltState = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported' | 'insecure';

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

type Vec3 = [number, number, number];

// Gravity in device coordinates, derived from beta and gamma alone: alpha is a compass heading and
// turning on it never moves gravity. Working from the vector is the fix for the motion feeling
// jumpy: read as angles, gamma runs away as beta approaches 90 degrees -- the pose a phone is held
// in while reading -- so ordinary wrist movement used to slam the scene to its limits. Gravity has
// no such pole.
function gravityInDevice(beta: number, gamma: number): Vec3 {
  const b = beta * Math.PI / 180;
  const g = gamma * Math.PI / 180;
  return [Math.cos(b) * Math.sin(g), -Math.sin(b), -Math.cos(b) * Math.cos(g)];
}

// The screen itself may be turned inside the device, so gravity is rotated into screen coordinates;
// that keeps left-right meaning left-right in landscape too.
function toScreen([x, y, z]: Vec3, radians: number): Vec3 {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return [x * c + y * s, y * c - x * s, z];
}

// How much gravity lies in the screen plane. A phone held upright has all of it, a phone lying on
// the table none, and only the second case has an undefined roll, so this doubles as the test for
// lying flat: hypot, not -y, because -y alone is small for a phone held sideways in landscape.
function inPlaneGravity([x, y]: Vec3) {
  return Math.hypot(x, y);
}

// Roll and pitch of the device against the horizon, in degrees. Dividing by the in-plane magnitude
// keeps pitch well behaved while the screen is rolled: -y on its own collapses towards zero for a
// landscape pose, which is where the tilt used to go dead.
function horizon([x, y, z]: Vec3): [number, number] {
  const inPlane = inPlaneGravity([x, y, z]);
  return [Math.atan2(x, -y) * 180 / Math.PI, Math.atan2(-z, inPlane) * 180 / Math.PI];
}

function screenRadians() {
  return ((screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI) / 180;
}

function averageVector(vectors: Vec3[]): Vec3 {
  const sum: Vec3 = [0, 0, 0];
  for (const vector of vectors) {
    sum[0] += vector[0];
    sum[1] += vector[1];
    sum[2] += vector[2];
  }
  return [sum[0] / vectors.length, sum[1] / vectors.length, sum[2] / vectors.length];
}

// Nothing inside the dead zone, then a smoothstep up to full deflection. A linear map moved the
// scene as much for a tremor as for a deliberate lean.
function tiltShape(degrees: number) {
  const reach = Math.min(1, Math.max(0, (Math.abs(degrees) - tiltDeadZone) / (tiltRange - tiltDeadZone)));
  return Math.sign(degrees) * reach * reach * (3 - 2 * reach);
}

// iOS and iPadOS are the only platforms where the sensor prompt has to be raised by a gesture. Chrome
// also ships requestPermission, but it answers by itself, and asking on load there must not cost the
// visitor a click. iPadOS reports itself as a Mac, so the touch count is what gives it away.
function isAppleTouchDevice() {
  if (/iP(hone|ad|od)/.test(navigator.userAgent)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

// iOS only raises the sensor prompt when requestPermission runs inside a gesture; anywhere else the
// call fails without asking. So this decides whether the ask has to keep a tap in reserve.
function tiltNeedsGesture() {
  const api = window.DeviceOrientationEvent as OrientationEvent | undefined;
  return isAppleTouchDevice() && typeof api?.requestPermission === 'function' && !motionBlockedByContext();
}

// Resolves the sensor permission. Callers only reach it on load where no gesture is needed, or from
// inside a gesture where iOS insists the prompt belongs.
async function askTiltPermission(): Promise<TiltState> {
  const api = window.DeviceOrientationEvent as OrientationEvent | undefined;
  if (motionBlockedByContext()) return 'insecure';
  // No sensor API at all (most desktops): leave the switch untouched instead of greying it out.
  if (!api) return 'unsupported';
  // Only iOS withholds the sensor until it says yes. Everywhere else the events simply arrive, so a
  // "denied" from an unimplemented prompt must not disable the switch.
  if (typeof api.requestPermission !== 'function' || !isAppleTouchDevice()) return 'granted';

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
  // Where the tilt is heading; nextX/nextY chase it so sensor noise arrives as motion, not jitter.
  let targetX = 0;
  let targetY = 0;
  let chase: number | undefined;
  let mode: Mode = prefersTilt() ? 'tilt' : 'pointer';
  let tiltState: TiltState = 'unknown';
  let tiltEnabled = tiltPreference();
  let listening = false;
  let requesting = false;
  // True while the visitor's click is waiting on an answer: the switch stays where they put it until
  // the browser replies, then either the sensor proves itself or the switch goes back with a message.
  let pendingAsk = false;
  // True once a real sample has arrived. Until then the sensor is unproven, and nothing may claim the
  // effect is running.
  let dataSeen = false;
  let probe: number | undefined;
  let toastTimer: number | undefined;
  // The pose the device rests in: roll and pitch in degrees, filled in from the first few samples.
  let restRoll = 0;
  let restPitch = 0;
  let restAngle = Number.NaN;
  const resting: Vec3[] = [];
  let lastTiltAt = 0;
  // Set once a pose outside the range has been adopted, and kept until the scene is back near level:
  // adoption has to run to completion, or it would stop just far enough out to stay pinned.
  let adopting = false;

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
    stop();
    targetX = nextX = Math.max(-1, Math.min(1, x));
    targetY = nextY = Math.max(-1, Math.min(1, y));
    paint();
  }

  function stop() {
    if (chase !== undefined) cancelAnimationFrame(chase);
    chase = undefined;
  }

  // Chase the tilt target frame by frame. Time based, so a slow phone eases at the same speed as a
  // fast one instead of stuttering.
  function chaseTilt() {
    if (chase !== undefined) return;
    let last = performance.now();
    const step = (now: number) => {
      const elapsed = Math.min(64, now - last);
      last = now;
      const k = 1 - Math.exp(-elapsed / tiltEase);
      nextX += (targetX - nextX) * k;
      nextY += (targetY - nextY) * k;
      const arrived = Math.abs(targetX - nextX) < .0015 && Math.abs(targetY - nextY) < .0015;
      if (arrived) {
        nextX = targetX;
        nextY = targetY;
      }
      paint();
      chase = arrived ? undefined : requestAnimationFrame(step);
    };
    chase = requestAnimationFrame(step);
  }

  function settle() {
    stop();
    targetX = 0;
    targetY = 0;
    nextX = 0;
    nextY = 0;
    paint();
  }

  // Measure the pose again from the next samples: a new grip, a turned screen or a returning tab all
  // invalidate the old zero point.
  function forgetPose() {
    restAngle = Number.NaN;
    resting.length = 0;
    adopting = false;
  }

  // On by default, but only claims to be on when the scene can actually move: the pointer is always
  // there, and the sensor has to have spoken at least once. A switch left checked while nothing
  // happens is worse than an honest "off".
  function effectLive() {
    return mode === 'pointer' || dataSeen;
  }

  function syncToggle() {
    if (toggle) {
      toggle.checked = tiltEnabled && (effectLive() || pendingAsk);
      // Never disabled and never dimmed by an answer: a no is not final, the visitor can ask again.
      toggle.disabled = false;
    }
    const label = toggle?.closest('label');
    if (label && tiltState === 'insecure') label.title = '需要通过 HTTPS 访问才能启用倾斜动效';
    else if (label && tiltState === 'denied') label.title = '运动与方向权限被拒绝，可再点一次重试';
    else if (label && tiltState === 'unsupported') label.title = '这台设备没有运动与方向传感器';
    else if (label && tiltState === 'prompt') label.title = '开启时会请求运动与方向权限';
    else label?.removeAttribute('title');
  }

  function persistTilt(on: boolean) {
    try {
      localStorage.setItem(tiltStorageKey, on ? 'on' : 'off');
    } catch {
      // Keep the choice for this page.
    }
  }

  function showToast(message: string) {
    let toast = document.querySelector<HTMLElement>('.home-tilt-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'home-tilt-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.append(toast);
    }
    toast.textContent = message;
    toast.dataset.visible = '';
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast?.removeAttribute('data-visible'), 5600);
  }

  // Watch the sensor for a moment. Silence means this device cannot feed the effect -- no gyroscope,
  // or the sensor is claimed elsewhere -- so it goes off rather than sitting there doing nothing. The
  // stored preference is left alone: the next load tries again instead of remembering a failure.
  function probeSensor(announce: boolean) {
    if (!tiltEnabled || dataSeen || probe !== undefined || mode !== 'tilt') return;
    probe = window.setTimeout(() => {
      probe = undefined;
      if (dataSeen || controller.signal.aborted) return;
      tiltEnabled = false;
      if (toggle) toggle.checked = false;
      settle();
      syncToggle();
      if (announce) showToast('这台设备读不到运动数据，基于设备运动的倾斜动效已关闭。');
    }, tiltProbeMs);
  }

  function tilt({ alpha, beta, gamma }: DeviceOrientationEvent) {
    (window as any).__tiltSample = [alpha, beta, gamma]
      .map(value => (typeof value === 'number' ? value.toFixed(0) : '-'))
      .join(',');
    if (!tiltEnabled || mode !== 'tilt') return;
    if (beta === null || gamma === null || !Number.isFinite(beta) || !Number.isFinite(gamma)) return;
    if (!dataSeen) {
      // The switch may say "off" until this very sample; now it can say the truth.
      dataSeen = true;
      window.clearTimeout(probe);
      probe = undefined;
      syncToggle();
    }

    const radians = screenRadians();
    const gravity = toScreen(gravityInDevice(beta, gamma), radians);
    // Lying flat: that pose has no meaningful left-right, and the angles below would jump about.
    if (inPlaneGravity(gravity) < tiltFlatness) return;

    const [roll, pitch] = horizon(gravity);

    // Recalibrate when the screen turns: roll and pitch swap roles, so the old zero point is wrong.
    if (radians !== restAngle) {
      restAngle = radians;
      resting.length = 0;
      adopting = false;
    }
    if (resting.length < tiltRestSamples) {
      resting.push(gravity);
      if (resting.length === tiltRestSamples) {
        [restRoll, restPitch] = horizon(averageVector(resting));
      }
      settle();
      return;
    }

    let dx = roll - restRoll;
    const dy = pitch - restPitch;

    // Held well outside the range: the visitor has changed how they hold the phone (lying down, phone
    // propped on a knee) rather than tilted it further. Following the pose all the way eases the scene
    // back to level under the new grip, so the effect has room to answer again -- and it keeps going
    // until it gets there, because stopping at the edge of the range would leave the scene pinned.
    const now = performance.now();
    const elapsed = Math.min(120, now - lastTiltAt);
    lastTiltAt = now;
    const deflection = Math.max(Math.abs(dx), Math.abs(dy));
    const follow = adopting ? deflection > tiltRange * .4 : deflection > tiltAdoptSpan;
    if (follow) {
      adopting = true;
      const k = 1 - Math.exp(-elapsed / tiltAdoptMs);
      restRoll += dx * k;
      restPitch += dy * k;
      dx = roll - restRoll;
    } else {
      adopting = false;
    }

    targetX = tiltShape(dx);
    targetY = tiltShape(pitch - restPitch);
    chaseTilt();
  }

  function enableTilt(announce = false) {
    if (tiltState !== 'granted') return;
    if (!listening) {
      listening = true;
      window.addEventListener('deviceorientation', tilt, options);
    }
    probeSensor(announce);
  }

  function requestTilt(origin: 'load' | 'gesture' = 'gesture') {
    if (requesting || tiltState === 'granted') return;
    requesting = true;
    if (origin === 'gesture') {
      pendingAsk = true;
      syncToggle();
    }
    askTiltPermission().then(state => {
      requesting = false;
      pendingAsk = false;
      if (controller.signal.aborted) return;
      // The ask made on load can only succeed quietly, for a site that was already allowed. Refused
      // there it means "not decided yet", not "no": the state stays prompt for the tap that follows.
      if (origin === 'load' && state === 'denied') {
        tiltState = 'prompt';
        syncToggle();
        return;
      }
      tiltState = state;
      if (state === 'granted') {
        if (origin === 'gesture') {
          tiltEnabled = true;
          persistTilt(true);
          mode = 'tilt';
          forgetPose();
        }
        enableTilt(origin === 'gesture');
      } else if (origin === 'gesture') {
        // Asked from a click, and still no permission: the effect stays off, and now says why. The
        // answer is not treated as final -- nothing is remembered and nothing is disabled, so the
        // next click asks again.
        settle();
        if (toggle) toggle.checked = false;
        showToast(state === 'insecure'
          ? '需要通过 HTTPS 访问才能启用倾斜动效。'
          : state === 'unsupported'
            ? '这台设备没有运动与方向传感器，基于设备运动的倾斜动效保持关闭。'
            : '没有获得运动与方向权限，基于设备运动的倾斜动效保持关闭。可以再点一次重试；若一直失败，请在浏览器的网站设置里允许这项权限或重置站点数据。');
      }
      syncToggle();
    });
  }

  // iOS prompts only from inside a gesture -- a click or a tap that ends, not the touch that starts
  // one -- and the answer is remembered per site. The ask on load below is the quiet attempt (it can
  // only succeed for a site that already said yes); the switch in the appearance panel is where the
  // visitor asks for real, because a page that pounces with a permission dialog on the first tap
  // anywhere is worse than one that simply starts with the effect off.

  window.addEventListener('pointermove', event => {
    if (!tiltEnabled || event.pointerType !== 'mouse') return;
    if (mode !== 'pointer') {
      mode = 'pointer';
      forgetPose();
      settle();
      syncToggle();
    }
    move(2 * event.clientX / innerWidth - 1, 2 * event.clientY / innerHeight - 1);
  }, options);

  for (const type of ['touchstart', 'pointerdown'] as const) {
    window.addEventListener(type, event => {
      if (type === 'pointerdown' && (event as PointerEvent).pointerType === 'mouse') return;
      if (mode !== 'tilt') {
        mode = 'tilt';
        forgetPose();
        settle();
        syncToggle();
      }
    }, options);
  }

  // Coming back to a tab after a while usually means a different grip: measure the pose again
  // instead of tilting from wherever the phone happened to be the last time.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) forgetPose();
  }, options);

  // The pointer leaving the page keeps the scene where it was: the cursor often leaves only to
  // reach the browser chrome (or another display) and comes straight back, and the snap to flat
  // in between read as the effect fighting the visitor. Losing window focus still settles, so a
  // tilted scene never sits frozen behind another app.
  window.addEventListener('blur', settle, options);

  toggle?.addEventListener('change', () => {
    tiltEnabled = toggle.checked;
    persistTilt(tiltEnabled);
    forgetPose();
    if (!tiltEnabled) {
      settle();
    } else if (tiltState === 'granted') {
      // Already allowed: nothing to ask, only a sensor left to prove.
      enableTilt(true);
    } else {
      // The tap that flipped the switch is the gesture iOS wants, and the place to report back when
      // the answer is no.
      requestTilt('gesture');
    }
    syncToggle();
  }, options);

  if (tiltNeedsGesture()) {
    // Nothing can move before the visitor says yes, so the switch starts off and says so. The quiet
    // ask on load still runs: a site that was already allowed answers without a prompt.
    tiltState = 'prompt';
    syncToggle();
    requestTilt('load');
  } else {
    requestTilt('load');
    syncToggle();
  }

  return () => {
    controller.abort();
    stop();
    window.clearTimeout(probe);
    window.clearTimeout(toastTimer);
    document.querySelector('.home-tilt-toast')?.remove();
    if (frame !== undefined) cancelAnimationFrame(frame);
    for (const { layer } of targets) {
      delete layer.dataset.parallax;
      layer.style.removeProperty('transform');
    }
  };
}
