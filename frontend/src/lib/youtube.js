/** Pulls the 11-character video id out of any usual YouTube link (watch, youtu.be, embed, shorts, live) or a bare id. "" when it is not one. */
const ID = /^[A-Za-z0-9_-]{11}$/;

export function youtubeId(input) {
  const s = String(input || "").trim();
  if (!s) return "";
  if (ID.test(s)) return s;
  let u;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); } catch { return ""; }
  const host = u.hostname.replace(/^(www|m)\./, "");
  let id = "";
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v") || "";
    else { const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/); id = m ? m[1] : ""; }
  }
  return ID.test(id) ? id : "";
}

export const youtubeThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
