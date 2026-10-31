import { bustPublicLists } from "../services/public.js";

/** Pin scopes: home = homepage Folders card (max 3), all = View all folders, section = Aqaid / Masail pages. */
export const PIN_KEY = { home: "pinHome", all: "pinAll", section: "pinSection" };

/** Pins / unpins a folder for one scope (admin only; the server re-checks the session and the 3-folder homepage limit).
 *  Returns true when it worked; on failure it tells the admin why and returns false. */
export async function togglePin(folder, scope) {
  const key = PIN_KEY[scope];
  try {
    const { adminApi } = await import("../services/admin.js");
    await adminApi.topics.update(folder.id, { [key]: !folder[key] });
    bustPublicLists();
    return true;
  } catch (e) {
    window.alert(e?.message || "Pin nahi ho saka. Dobara koshish karein.");
    return false;
  }
}
