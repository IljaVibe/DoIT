import { useEffect, useRef, useState } from "react";
import { emptyState, type State } from "./model";
const KEY = "doit-browser-v1";
export function useStore() {
  const [state, setState] = useState<State>(emptyState);
  const ref = useRef(state);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
  const [error, setError] = useState("");
  const queue = useRef(Promise.resolve());
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = window.doit
          ? await window.doit.load()
          : JSON.parse(localStorage.getItem(KEY) || "null") || emptyState();
        if (active) {
          ref.current = data;
          setState(data);
          setLoaded(true);
        }
      } catch (e) {
        if (active) {
          setError(String(e));
          setStatus("error");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  const persist = (next: State) => {
    const version = ++generation.current;
    setStatus("saving");
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        try {
          if (window.doit) await window.doit.save(next);
          else localStorage.setItem(KEY, JSON.stringify(next));
          if (version === generation.current) {
            setStatus("saved");
            setError("");
          }
        } catch (e) {
          setStatus("error");
          setError(String(e));
          throw e;
        }
      });
    queue.current.catch(() => {});
  };
  const update = (fn: (state: State) => State) => {
    const next = fn(ref.current);
    ref.current = next;
    setState(next);
    persist(next);
  };
  const replace = (next: State) => {
    ref.current = next;
    setState(next);
    setStatus("saved");
    setError("");
  };
  return {
    state,
    update,
    replace,
    loaded,
    status,
    error,
    flush: () => queue.current,
    retry: () => persist(ref.current),
  };
}
