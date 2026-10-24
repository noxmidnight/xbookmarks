import { registerPlugin } from "@capacitor/core";
import { Capacitor } from "@capacitor/core";

type BraveBrowserPlugin = {
  open(options: { url: string }): Promise<{ package: string; brave: boolean }>;
  isBraveInstalled(): Promise<{ installed: boolean; package: string | null }>;
};

const BraveBrowser = registerPlugin<BraveBrowserPlugin>("BraveBrowser");

export async function openInBrave(url: string): Promise<{
  opened: boolean;
  brave: boolean;
  package?: string;
}> {
  if (!Capacitor.isNativePlatform()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return { opened: true, brave: false };
  }
  try {
    const result = await BraveBrowser.open({ url });
    return { opened: true, brave: result.brave, package: result.package };
  } catch {
    return { opened: false, brave: false };
  }
}

export async function isBraveInstalled(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const result = await BraveBrowser.isBraveInstalled();
    return result.installed;
  } catch {
    return false;
  }
}
