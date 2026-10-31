/** Real-folder icon: lighter back panel with the tab, yellow body in front. Same colours in Light and Dark.
 *  size = width in px (height follows, ratio 100:84). Pass fluid to make it fill the width of its parent instead. */
export function FolderIcon({ size = 24, fluid = false, className = "" }) {
  const dims = fluid ? { width: "100%" } : { width: size, height: Math.round(size * 0.84) };
  return (
    <svg viewBox="0 0 100 84" aria-hidden="true" focusable="false" className={`block ${className}`} {...dims}>
      <path d="M4 10a6 6 0 0 1 6-6h24a6 6 0 0 1 4.6 2.1l5.3 6.4H90a6 6 0 0 1 6 6V76a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6z" fill="#FFDA79" />
      <path d="M4 34a6 6 0 0 1 6-6h80a6 6 0 0 1 6 6v42a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6z" fill="#F7B928" />
    </svg>
  );
}
