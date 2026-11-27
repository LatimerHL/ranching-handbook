/**
 * 输入方式与 Popover 兼容层。
 *
 * 1. 混合设备（安卓外接鼠标、笔电触摸屏）的 `any-hover` 常报成 `none`，
 *    导致图标按钮的悬停提示永远不出现。这里按真实输入事件在 <html> 上打
 *    `data-input="mouse|touch"`，CSS 据此单独放行悬停提示。
 * 2. `popovertarget` 依赖浏览器的原生实现，部分安卓浏览器上按钮点了毫无反应
 *    （普通链接却正常）。这里统一用 JS 接管按钮，面板开合只认 `is-open` 这个 class。
 *    原生 Popover API 完全不参与：两套状态并存时，手势关闭只改 class，原生 popover
 *    仍留在顶层，抽屉松手后会被它拽回原位——这正是「拖拽收起又回弹」的来源。
 * 3. 安卓模拟器/带触控映射的鼠标会同时发出鼠标与触摸事件，导致鼠标也能拖出
 *    侧栏抽屉。这里记录最近一次真实指针类型，供拖拽逻辑判断。
 */

// The shim drives every browser: native popovertarget has been unreliable (missing API on some
// Android builds, double-toggling elsewhere) and it animates differently per engine. One JS path
// keeps the drawer/panel motion identical, at the cost of a single `is-open` class.
let lastPointerType = '';
let lastPointerAt = 0;

export function lastPointerWasMouse(withinMs = 500) {
  return lastPointerType === 'mouse' && performance.now() - lastPointerAt < withinMs;
}

export function isPopoverOpen(element: HTMLElement) {
  return element.classList.contains('is-open');
}

function syncTriggers(element: HTMLElement, open: boolean) {
  for (const trigger of document.querySelectorAll('[data-popover-target]')) {
    if (trigger.getAttribute('data-popover-target') === element.id) {
      trigger.setAttribute('aria-expanded', String(open));
    }
  }
}

export function openPopover(element: HTMLElement) {
  // A drag that never received its pointerup leaves these behind; they pin the drawer at its
  // dragged offset, so opening it by trigger would look like "the button does nothing".
  const hero = element.closest('.home-hero') as HTMLElement | null;
  if (hero) {
    hero.removeAttribute('data-drawer-dragging');
    hero.style.removeProperty('--drawer-offset');
    hero.style.removeProperty('--drawer-progress');
  }
  // The panels stay in the layout (closed = visibility:hidden) so both directions of the
  // transform/opacity transition run; there is nothing to seed here.
  element.classList.add('is-open');
  element.inert = false;
  syncTriggers(element, true);
}

export function closePopover(element: HTMLElement) {
  element.classList.remove('is-open');
  element.inert = true;
  syncTriggers(element, false);
}

// Some Android builds report an empty pointerType (or "pen") for a real mouse, and a few never send
// pointerenter at all. Treat anything that is not a finger as a hovering pointer.
function isHoverPointer(event: PointerEvent) {
  return event.pointerType !== 'touch';
}

function trackInput() {
  const root = document.documentElement;
  const mark = (kind: 'mouse' | 'touch') => {
    if (root.dataset.input !== kind) root.dataset.input = kind;
  };
  const note = (type: string) => {
    lastPointerType = type;
    lastPointerAt = performance.now();
  };

  window.addEventListener('pointermove', event => {
    if (isHoverPointer(event)) mark('mouse');
    note(event.pointerType);
  }, { passive: true });
  window.addEventListener('pointerdown', event => {
    note(event.pointerType);
    mark(isHoverPointer(event) ? 'mouse' : 'touch');
  }, { passive: true, capture: true });
  window.addEventListener('touchstart', () => mark('touch'), { passive: true, capture: true });
}

function bindTriggers() {
  // One browser-generated click toggles once. The coordinates are not trusted: Chromium on Android
  // can deliver a mouse click aimed at a stale position, so when the click did not land on a trigger
  // we hit-test the point it reports and the last position we saw. Extra pointerdown/pointerup paths
  // used to toggle as well and every one of them eventually fired twice on some device, leaving the
  // drawer looking dead.
  // Chromium on Android ignores the ACTION_DOWN/ACTION_UP that carry a mouse press and only uses
  // ACTION_BUTTON_PRESS/RELEASE, so when hover is unavailable the click can arrive with a stale (or
  // zero) position and hit the wrong element. Remember where the pointer actually is and fall back
  // to hit-testing that point when the click did not land on a trigger.
  let pointerX = -1;
  let pointerY = -1;
  const remember = (event: MouseEvent) => {
    if ((event as PointerEvent).pointerType === 'touch') return;
    pointerX = event.clientX;
    pointerY = event.clientY;
  };
  window.addEventListener('pointermove', remember, { capture: true, passive: true });
  window.addEventListener('mousemove', remember, { capture: true, passive: true });

  let lastToggle = 0;
  const guarded = (panel: HTMLElement, open: boolean) => {
    const now = performance.now();
    if (now - lastToggle < 350) return;
    lastToggle = now;
    for (const other of document.querySelectorAll<HTMLElement>('[data-popover-panel]')) {
      if (other !== panel && isPopoverOpen(other)) closePopover(other);
    }
    if (open) openPopover(panel);
    else closePopover(panel);
    window.__popoverShimUsed = (window.__popoverShimUsed ?? 0) + 1;
    (window as any).__lastTrigger = (panel.id || '?') + (open ? ':open' : ':close');
  };

  const resolve = (element: Element | null) => {
    const trigger = element?.closest?.('[data-popover-target]');
    if (!trigger) return null;
    const panel = document.getElementById(trigger.getAttribute('data-popover-target') ?? '');
    if (!panel || !panel.hasAttribute('data-popover-panel')) return null;
    return {
      panel: panel as HTMLElement,
      action: trigger.getAttribute('data-popover-action') ?? 'toggle',
    };
  };

  document.addEventListener('click', event => {
    let hit = resolve(event.target as Element | null);
    // Keyboard and assistive activation use the focused target. The Android mouse fallback may
    // also receive an empty pointer type or "pen", so check the tracked input for those events.
    const pointerType = (event as PointerEvent).pointerType;
    const mouseClick = event.detail > 0 && (pointerType === 'mouse'
      || (pointerType !== 'touch' && document.documentElement.dataset.input === 'mouse'));
    if (!hit && mouseClick) {
      hit = resolve(document.elementFromPoint(event.clientX, event.clientY))
        ?? (pointerX >= 0 ? resolve(document.elementFromPoint(pointerX, pointerY)) : null);
    }
    if (!hit) return;
    const open = hit.action === 'show' ? true : hit.action === 'hide' ? false : !isPopoverOpen(hit.panel);
    guarded(hit.panel, open);
  }, true);
}

function fallbackDismiss() {
  for (const element of document.querySelectorAll<HTMLElement>('[data-popover-panel]')) {
    if (!element.classList.contains('is-open')) element.inert = true;
  }

  document.addEventListener('pointerdown', event => {
    const open = [...document.querySelectorAll<HTMLElement>('[data-popover-panel].is-open')];
    if (!open.length) return;
    const target = event.target as Element | null;
    if (!target) return;
    // A scrim closes its panel on click: closing here would turn off the scrim's
    // pointer-events before the finger lifts, so the same tap would reach the page below.
    if (target.closest?.('[data-popover-scrim]')) return;
    if (open.some(element => element.contains(target)) || target.closest?.('[data-popover-target]')) return;
    for (const element of open) closePopover(element);
  }, true);

  // A scrim closes its panel on click (not pointerdown, see above). Bound here, on the
  // document, so it also works after a client-side navigation replaced the panel markup.
  document.addEventListener('click', event => {
    const target = event.target as Element | null;
    const scrim = target?.closest?.('[data-popover-scrim]');
    if (!scrim) return;
    const panel = document.getElementById(scrim.getAttribute('data-popover-scrim') ?? '');
    event.preventDefault();
    event.stopPropagation();
    if (panel) closePopover(panel);
    else for (const element of document.querySelectorAll<HTMLElement>('[data-popover-panel].is-open')) closePopover(element);
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    for (const element of document.querySelectorAll<HTMLElement>('[data-popover-panel].is-open')) closePopover(element);
  });
}


const hoverTargets = '.home-icon-button, .home-menu a, .home-menu-heading button, .home-theme label, .home-notice a';

function bindHover() {
  const clear = () => {
    for (const element of document.querySelectorAll('[data-hover]')) element.removeAttribute('data-hover');
  };
  document.addEventListener('pointerenter', event => {
    if (!isHoverPointer(event)) return;
    const target = (event.target as Element | null)?.closest?.(hoverTargets);
    if (!target) return;
    for (const element of document.querySelectorAll('[data-hover]')) {
      if (element !== target) element.removeAttribute('data-hover');
    }
    target.setAttribute('data-hover', '');
  }, true);
  document.addEventListener('pointerleave', event => {
    const target = (event.target as Element | null)?.closest?.(hoverTargets);
    target?.removeAttribute('data-hover');
  }, true);

  // 有些安卓浏览器不发 pointerenter，直接用坐标命中判断鼠标压在哪个目标上。
  let hoverFrame: number | undefined;
  const paintHoverAt = (x: number, y: number) => {
    const under = document.elementFromPoint(x, y);
    const target = under?.closest?.(hoverTargets) ?? null;
    for (const element of document.querySelectorAll('[data-hover]')) {
      if (element !== target) element.removeAttribute('data-hover');
    }
    if (target && !target.hasAttribute('data-hover')) target.setAttribute('data-hover', '');
  };
  window.addEventListener('pointermove', event => {
    if (!isHoverPointer(event)) return;
    if (hoverFrame !== undefined) return;
    hoverFrame = requestAnimationFrame(() => {
      hoverFrame = undefined;
      paintHoverAt(event.clientX, event.clientY);
    });
  }, { passive: true });

  // 硬件鼠标在部分安卓浏览器上只发兼容鼠标事件（不发 pointerenter/pointermove），
  // 所以再按坐标兜一层；触摸后 800ms 内的兼容鼠标事件忽略，免得点一下出现悬停提示。
  let lastTouchAt = 0;
  window.addEventListener('touchstart', () => {
    lastTouchAt = performance.now();
  }, { passive: true, capture: true });
  const fromRecentTouch = () => performance.now() - lastTouchAt < 800;
  document.addEventListener('mouseover', event => {
    const target = (event.target as Element | null)?.closest?.('a, button, label, input, summary, [role="button"]');
    if (!target) return;
    const now = performance.now();
    if (now - lastTouchAt < 800) return;
    paintHoverAt(event.clientX, event.clientY);
  }, true);
  document.addEventListener('mouseout', event => {
    if ((event.relatedTarget as Element | null)) return;
    clear();
  }, true);

  const onCompatMove = (event: MouseEvent) => {
    if (fromRecentTouch()) return;
    if (hoverFrame !== undefined) return;
    const { clientX, clientY } = event;
    hoverFrame = requestAnimationFrame(() => {
      hoverFrame = undefined;
      paintHoverAt(clientX, clientY);
    });
  };
  document.addEventListener('mousemove', onCompatMove, { passive: true });
  document.addEventListener('mouseover', onCompatMove, { passive: true });
  // Some mice deliver presses but no motion while hovering; pressing an icon still shows its label.
  window.addEventListener('pointerdown', event => {
    if (!isHoverPointer(event)) return;
    paintHoverAt(event.clientX, event.clientY);
  }, { capture: true, passive: true });
  window.addEventListener('blur', clear);
  document.addEventListener('scroll', clear, { passive: true, capture: true });
}

function diagnostics() {
  if (!/[?&]diag/.test(location.search)) return;

  const events: string[] = [];
  const stats = { down: 0, up: 0, click: 0, touch: 0, pm: 0, po: 0, mm: 0, mo: 0, raw: 0, at: '-' };
  const panel = document.createElement('pre');
  panel.style.cssText = [
    'position:fixed', 'z-index:2147483647', 'left:0', 'right:0', 'bottom:0', 'margin:0',
    'padding:8px 10px', 'max-height:46vh', 'overflow:auto',
    'background:#000d', 'color:#9ff', 'font:11px/1.45 monospace', 'white-space:pre-wrap',
    'pointer-events:none',
  ].join(';');
  document.body.append(panel);

  const push = (line: string) => {
    events.push(line);
    if (events.length > 6) events.shift();
  };
  const media = (query: string) => (matchMedia(query).matches ? 'yes' : 'no');

  const describe = (target: EventTarget | null) => {
    const element = target as Element | null;
    if (!element) return 'null';
    const cls = (element.className || '').toString().split(' ').filter(Boolean).slice(0, 3).join('.');
    return (element.tagName || '?').toLowerCase() + (cls ? '.' + cls : '');
  };

  window.addEventListener('pointerdown', event => {
    stats.down += 1;
    push('pointerdown ' + event.pointerType + ' @' + Math.round(event.clientX) + ',' + Math.round(event.clientY)
      + ' → ' + describe(event.target));
  }, { capture: true });
  window.addEventListener('pointerup', event => {
    stats.up += 1;
    push('pointerup ' + event.pointerType + ' → ' + describe(event.target));
  }, { capture: true });
  window.addEventListener('mousedown', event => {
    push('mousedown → ' + describe(event.target));
  }, { capture: true });
  window.addEventListener('mouseup', event => {
    push('mouseup ' + describe(event.target));
  }, { capture: true });
  window.addEventListener('click', event => {
    stats.click += 1;
    const trigger = (event.target as Element | null)?.closest?.('[data-popover-target]');
    push('click → ' + describe(event.target) + (trigger ? ' [trigger]' : ''));
  }, { capture: true });
  window.addEventListener('touchstart', () => {
    stats.touch += 1;
    push('touchstart');
  }, { capture: true, passive: true });

  const move = (event: MouseEvent, key: 'pm' | 'po' | 'mm' | 'mo' | 'raw') => {
    stats[key] += 1;
    stats.at = Math.round(event.clientX) + ',' + Math.round(event.clientY);
  };
  window.addEventListener('pointermove', event => move(event, 'pm'), { capture: true, passive: true });
  window.addEventListener('pointerover', event => move(event, 'po'), { capture: true, passive: true });
  window.addEventListener('mousemove', event => move(event, 'mm'), { capture: true, passive: true });
  window.addEventListener('mouseover', event => move(event, 'mo'), { capture: true, passive: true });
  window.addEventListener('pointerrawupdate', event => move(event as MouseEvent, 'raw'), { capture: true });

  const render = () => {
    const lines = [
      'UA ' + navigator.userAgent.slice(0, 70),
      'popover=class-only'
        + ' hover/any=' + media('(hover: hover)') + '/' + media('(any-hover: hover)')
        + ' point/any=' + media('(pointer: fine)') + '/' + media('(any-pointer: fine)'),
      'counts down=' + stats.down + ' up=' + stats.up + ' click=' + stats.click
        + ' touch=' + stats.touch + ' shim=' + (window.__popoverShimUsed ?? 0)
        + ' last=' + ((window as any).__lastTrigger ?? '-'),
      'motion pm=' + stats.pm + ' po=' + stats.po + ' mm=' + stats.mm + ' mo=' + stats.mo
        + ' raw=' + stats.raw + ' at=' + stats.at,
    ];
    const menu = document.querySelector('#home-menu') as HTMLElement | null;
    if (menu) {
      const style = getComputedStyle(menu);
      lines.push('menu open=' + (menu.classList.contains('is-open') ? 'Y' : 'N')
        + ' vis=' + style.visibility + ' tf=' + style.transform.slice(0, 26)
        + ' w=' + Math.round(menu.getBoundingClientRect().width)
        + ' dragging=' + (menu.closest('.home-hero')?.hasAttribute('data-drawer-dragging') ? 'Y' : 'N')
        + ' vw=' + innerWidth);
    }
    panel.textContent = [...lines, '--- events ---', ...events].join('\n');
  };
  render();
  setInterval(render, 800);
}

trackInput();
bindTriggers();
bindHover();
fallbackDismiss();
diagnostics();
