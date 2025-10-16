export const createBackoff = ({ base = 5000, max = 300000 } = {}) => {
  let delay = base;
  return {
    next() {
      const current = delay;
      delay = Math.min(delay * 2, max);
      return current;
    },
    reset() {
      delay = base;
    },
  };
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const nowInSeconds = () => Math.floor(Date.now() / 1000);

export const debounce = (fn, wait) => {
  let timer;
  let lastArgs = [];
  const debounced = (...args) => {
    lastArgs = args;
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...lastArgs);
    }, wait);
  };
  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer);
      fn(...lastArgs);
    }
  };
  return debounced;
};
