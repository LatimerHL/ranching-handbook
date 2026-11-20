(() => {
  const storageKey = 'ranching-handbook-theme';
  const modes = ['light', 'dark', 'system'];
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let mode = 'system';

  try {
    const saved = localStorage.getItem(storageKey);
    if (modes.includes(saved)) mode = saved;
  } catch {
    // Theme switching still works when storage is unavailable.
  }

  function applyTheme() {
    const dark = mode === 'dark' || (mode === 'system' && system.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const themeColor = document.querySelector('meta[name="theme-color"]');
    themeColor.content = dark ? '#1b1530' : themeColor.dataset.lightColor;
  }

  applyTheme();
  system.addEventListener('change', applyTheme);
  document.addEventListener('astro:after-swap', applyTheme);

  function syncOptions() {
    const option = document.querySelector('#home-theme input[value="' + mode + '"]');
    if (option) option.checked = true;
  }

  document.addEventListener('DOMContentLoaded', syncOptions);
  document.addEventListener('astro:page-load', syncOptions);
  document.addEventListener('change', ({ target }) => {
    if (!target.matches('#home-theme input[name="site-theme"]') || !modes.includes(target.value)) return;
    mode = target.value;
    applyTheme();
    try {
      localStorage.setItem(storageKey, mode);
    } catch {
      // Keep the selected mode for the current page.
    }
  });
})();
