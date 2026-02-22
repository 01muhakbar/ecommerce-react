import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCartStore } from "../../store/cart.store.ts";
import { useStoreCategories } from "../../hooks/useStoreCategories.ts";
import TopInfoBar from "./TopInfoBar.jsx";
import GreenHeaderBar from "./GreenHeaderBar.jsx";
import NavBar from "./NavBar.jsx";

export default function StoreHeaderKacha() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const totalQty = useCartStore((state) => state.totalQty);
  const { data: categories, isLoading: categoriesLoading } = useStoreCategories();

  const [search, setSearch] = useState("");
  const [showCategories, setShowCategories] = useState(false);
  const [showPages, setShowPages] = useState(false);

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    const handleClick = (event) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest("[data-demo-dropdown]")) {
        setShowCategories(false);
        setShowPages(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const q = search.trim();
    if (!q) return;
    const params = new URLSearchParams();
    params.set("q", q);
    params.set("page", "1");
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div>
      <div className="hidden sm:block">
        <TopInfoBar />
      </div>
      <GreenHeaderBar
        search={search}
        setSearch={setSearch}
        onSubmit={handleSearchSubmit}
        totalQty={totalQty}
      />
      <div className="hidden sm:block">
        <NavBar
          showCategories={showCategories}
          setShowCategories={setShowCategories}
          showPages={showPages}
          setShowPages={setShowPages}
          categories={categories}
          categoriesLoading={categoriesLoading}
        />
      </div>
    </div>
  );
}
