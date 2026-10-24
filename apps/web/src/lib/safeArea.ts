function measureEnvInset(edge: "top" | "bottom"): number {
  if (typeof document === "undefined") return 0;
  const probe = document.createElement("div");
  probe.style.cssText =
    edge === "top"
      ? "position:fixed;left:0;top:0;width:0;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none;"
      : "position:fixed;left:0;bottom:0;width:0;height:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none;";
  document.body.appendChild(probe);
  const h = probe.getBoundingClientRect().height;
  probe.remove();
  return Math.max(0, Math.ceil(h));
}

/** Measure Android/iOS bottom inset for layout + native WebView sizing. */
export function measureSafeAreaBottom(): number {
  return measureEnvInset("bottom");
}

/** Status-bar / notch inset — used when the Feed WebView must sit below the system bar. */
export function measureSafeAreaTop(): number {
  return measureEnvInset("top");
}

/** Bottom tab bar height (MUI BottomNavigation default). */
export const TAB_BAR_PX = 56;
