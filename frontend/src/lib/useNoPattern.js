import { useEffect } from "react";

/**
 * While a post is being read, previewed or written, the faint geometric pattern is switched off and only the plain
 * page colour shows. Puts `no-pattern` on <body> (CSS: body.no-pattern in index.css). Counted, so nested users
 * (editor + preview) never switch it back on too early.
 */
let users = 0;
export function useNoPattern() {
  useEffect(() => {
    users += 1;
    document.body.classList.add("no-pattern");
    return () => {
      users -= 1;
      if (users <= 0) { users = 0; document.body.classList.remove("no-pattern"); }
    };
  }, []);
}
