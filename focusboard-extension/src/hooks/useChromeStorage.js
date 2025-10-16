import { useCallback, useEffect, useState } from "react";

const hasChromeStorage = () => typeof chrome !== "undefined" && chrome.storage?.local;

const readLocal = (key, defaultValue) => {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.warn("Failed to parse localStorage for", key, error);
    window.localStorage.removeItem(key);
    return defaultValue;
  }
};

const writeLocal = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Failed to write localStorage for", key, error);
  }
};

const readChrome = async (key, defaultValue) => {
  if (!hasChromeStorage()) return readLocal(key, defaultValue);
  try {
    const result = await chrome.storage.local.get([key]);
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      return result[key];
    }
    return defaultValue;
  } catch (error) {
    console.warn("Failed to read chrome.storage for", key, error);
    return readLocal(key, defaultValue);
  }
};

const writeChrome = async (key, value) => {
  if (!hasChromeStorage()) {
    writeLocal(key, value);
    return;
  }
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (error) {
    console.warn("Failed to write chrome.storage for", key, error);
    writeLocal(key, value);
  }
};

export const useChromeStorage = (key, defaultValue) => {
  const [value, setValue] = useState(defaultValue);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    readChrome(key, defaultValue).then((storedValue) => {
      if (isMounted) {
        setValue(storedValue);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [key, defaultValue]);

  const updateValue = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        writeChrome(key, resolved);
        return resolved;
      });
    },
    [key]
  );

  return [value, updateValue, isLoading];
};

export default useChromeStorage;
