import React, { useEffect, useMemo, useRef, useState } from "react";
import { debounce } from "../utils/timers.js";

const STORAGE_KEY = "focusboard-memo";
const MAX_LENGTH = 5000;

const loadMemo = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ?? "";
  } catch (error) {
    console.warn("Failed to load memo", error);
    return "";
  }
};

const saveMemo = (value) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch (error) {
    console.warn("Failed to save memo", error);
  }
};

const MemoSection = () => {
  const [memo, setMemo] = useState(() => loadMemo());
  const debouncedRef = useRef();

  useEffect(() => {
    debouncedRef.current = debounce(saveMemo, 500);
    return () => {
      debouncedRef.current?.flush?.();
    };
  }, []);

  useEffect(() => {
    if (!debouncedRef.current) return;
    debouncedRef.current(memo);
  }, [memo]);

  const remaining = useMemo(() => MAX_LENGTH - memo.length, [memo]);

  return (
    <div className="memo">
      <div className="memo__header">
        <h2 id="memo-heading">Memo</h2>
        <span className={`memo__counter ${remaining <= 50 ? "warn" : ""}`} aria-live="polite">
          남은 글자 {remaining < 0 ? 0 : remaining}
        </span>
      </div>
      <label className="sr-only" htmlFor="memo-field">
        메모 입력
      </label>
      <textarea
        id="memo-field"
        value={memo}
        onChange={(event) => setMemo(event.target.value.slice(0, MAX_LENGTH))}
        maxLength={MAX_LENGTH}
        placeholder="생각나는 아이디어를 적어보세요"
        rows={8}
      />
    </div>
  );
};

export default MemoSection;
