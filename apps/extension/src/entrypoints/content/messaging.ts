import type { ExtensionMessage, ExtensionResponse } from "../../lib/messages";

export async function sendMessage<T = unknown>(
  message: ExtensionMessage,
): Promise<T> {
  const res = (await browser.runtime.sendMessage(
    message,
  )) as ExtensionResponse;
  if (!res.ok) throw new Error(res.error);
  return res.data as T;
}

export function showToast(text: string) {
  document.querySelectorAll(".xb-toast").forEach((el) => el.remove());
  const toast = document.createElement("div");
  toast.className = "xb-toast";
  toast.textContent = text;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2200);
}
