import { useRef, useState } from "react";
import { adminApi } from "../../services/admin.js";
import { mediaUrl, isPdfKey } from "../../lib/media.js";
import { Icon } from "../../components/ui/icons.jsx";
import { useToast } from "./ui.jsx";

// The same picked file is uploaded ONCE: if the phone's file picker reports the pick twice (some Android pickers fire the
// "change" event two times), or the same file is picked again within a few seconds, the first upload's key is reused.
// Without this every such pick left a second, unused copy behind in the R2 bucket.
const recent = new Map(); // "name|size|lastModified" -> { promise, at }
const REUSE_MS = 20000;
function uploadOnce(file) {
  const sig = `${file.name}|${file.size}|${file.lastModified}`;
  const hit = recent.get(sig);
  if (hit && Date.now() - hit.at < REUSE_MS) return hit.promise;
  const promise = adminApi.upload(file);
  recent.set(sig, { promise, at: Date.now() });
  promise.catch(() => recent.delete(sig)); // a failed upload may be tried again at once
  return promise;
}

/** Uploads to R2 via POST /api/admin/media; stores only the returned key. */
export function MediaUploader({ value, onChange, accept = "image/*", label = "Upload file", compact }) {
  const toast = useToast();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const { key } = await uploadOnce(file);
      onChange(key);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  const url = mediaUrl(value);
  return (
    <div className="flex items-center gap-3">
      {value && (
        <div className={`shrink-0 overflow-hidden rounded-md border border-ad-rule bg-ad-bg ${compact ? "h-12 w-12" : "h-20 w-20"}`}>
          {isPdfKey(value) ? <div className="grid h-full place-items-center text-ad-mute"><Icon name="file" /></div> : <img src={url} alt="" className="h-full w-full object-cover" />}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="a-btn" disabled={busy} onClick={() => input.current?.click()}>
          <Icon name="upload" size={15} />{busy ? "Uploading…" : value ? "Replace" : label}
        </button>
        {value && <button type="button" className="a-btn" onClick={() => onChange("")}>Remove</button>}
      </div>
      <input ref={input} type="file" accept={accept} className="hidden" onChange={pick} />
    </div>
  );
}
