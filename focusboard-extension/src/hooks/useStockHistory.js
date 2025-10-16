import { useEffect, useState } from "react";
import { fetchStockHistory } from "../utils/fetchers.js";

const initialState = {
  status: "idle",
  data: null,
  error: null,
};

const useStockHistory = (symbol, range) => {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    if (!symbol) {
      setState(initialState);
      return undefined;
    }

    let isMounted = true;
    const controller = new AbortController();

    setState({ status: "loading", data: null, error: null });
    fetchStockHistory(symbol, range, { signal: controller.signal })
      .then((data) => {
        if (!isMounted) return;
        setState({ status: "success", data, error: null });
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        if (!isMounted) return;
        setState({ status: "error", data: null, error });
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [symbol, range]);

  return state;
};

export default useStockHistory;
