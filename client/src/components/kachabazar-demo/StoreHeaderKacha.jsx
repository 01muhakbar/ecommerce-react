import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCartStore } from "../../store/cart.store.ts";
import { useCategories } from "../../storefront.jsx";
import TopInfoBar from "./TopInfoBar.jsx";
import GreenHeaderBar from "./GreenHeaderBar.jsx";
import NavBar from "./NavBar.jsx";

const fallbackCategories = [
  { id: 1, name: "Fresh Fruits", slug: "fresh-fruits" },
  { id: 2, name: "Fresh Vegetables", slug: "fresh-vegetables" },
  { id: 3, name: "Fish & Meat", slug: "fish-meat" },
  { id: 4, name: "Milk & Dairy", slug: "milk-dairy" },
  { id: 5, name: "Beverages", slug: "beverages" },
  { id: 6, name: "Bread & Bakery", slug: "bread-bakery" },
];

export default function StoreHeaderKacha() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const totalQty = useCartStore((state) => state.totalQty);
  const { data } = useCategories();
  const categories = data?.data?.items ?? [];

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

  const categoryList = useMemo(() => {
    if (categories.length > 0) {
      return categories.map((category, index) => {
        const slug =
          category.slug ??
          category.code ??
          String(category._id ?? category.id ?? index);
        const name =
          category.name ??
          category.title ??
          category.label ??
          category.categoryName ??
          category.code ??
          category.slug ??
          "Category";
        const id = category.id ?? category._id ?? category.code ?? slug ?? index;
        return { ...category, id, name, slug, code: category.code ?? category.slug ?? "" };
      });
    }
    return fallbackCategories;
  }, [categories]);

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
      <TopInfoBar />
      <GreenHeaderBar
        search={search}
        setSearch={setSearch}
        onSubmit={handleSearchSubmit}
        totalQty={totalQty}
      />
      <NavBar
        showCategories={showCategories}
        setShowCategories={setShowCategories}
        showPages={showPages}
        setShowPages={setShowPages}
        dummyCategories={categoryList}
      />
    </div>
  );
}
