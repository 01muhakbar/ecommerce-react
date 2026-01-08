import { useEffect, useState } from "react";
import { getOrders } from "../api/orders.service.js";

export function useOrders(params = {}) {
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getOrders(params)
      .then((result) => {
        setData(result.data);
        setMeta(result.meta);
      })
      .catch(() => setError("Failed to load orders"))
      .finally(() => setLoading(false));
  }, [paramsKey]);

  return { data, meta, loading, error };
}
