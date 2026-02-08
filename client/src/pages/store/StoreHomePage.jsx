import { Link, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useCategories, useProducts, ProductCard } from "../../storefront.jsx";
import QueryState from "../../components/UI/QueryState.jsx";
import HeroSlider from "../../components/kachabazar-demo/HeroSlider.jsx";
import PopularProductsGrid from "../../components/kachabazar-demo/PopularProductsGrid.jsx";
import FeaturedCategoriesMega from "../../components/kachabazar-demo/FeaturedCategoriesMega.jsx";

export default function StoreHomePage() {
  const navigate = useNavigate();
  const [activeSlide, setActiveSlide] = useState(0);
  const slides = useMemo(
    () => [
      {
        title: "Fresh groceries delivered in minutes.",
        subtitle: "KachaBazaar • Daily essentials for your family",
      },
      {
        title: "Healthy picks, curated every day.",
        subtitle: "Discover seasonal fruits, veggies, and pantry staples",
      },
      {
        title: "Your neighborhood market, online.",
        subtitle: "Shop local favorites with fast checkout",
      },
    ],
    []
  );
  const heroSlide = slides[Math.max(0, Math.min(activeSlide, slides.length - 1))];

  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    isError: categoriesError,
    error: categoriesErrorObj,
    refetch: refetchCategories,
  } = useCategories();
  const {
    data: popularData,
    isLoading: popularLoading,
    isError: popularError,
    error: popularErrorObj,
    refetch: refetchPopular,
  } = useProducts({ page: 1, limit: 10 });

  const categories = categoriesData?.data?.items ?? [];
  const rawPopular =
    popularData?.data?.items ?? popularData?.data ?? popularData?.items ?? popularData ?? [];
  const popularProducts = Array.isArray(rawPopular) ? rawPopular : [];
  const featuredCategories = categories.map((category) => ({
    id: category.id ?? category.code ?? category.slug,
    name: category.name ?? "Category",
    slug: category.slug || category.code || String(category.id || ""),
    icon: category.icon ?? category.image ?? null,
    items: [],
  }));

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="space-y-12 py-8">
        <section>
          <HeroSlider
            heroSlide={heroSlide}
            slides={slides}
            activeSlide={activeSlide}
            setActiveSlide={setActiveSlide}
            onCta={() => navigate("/search")}
          />
        </section>

        <section>
          <QueryState
            isLoading={categoriesLoading}
            isError={categoriesError}
            error={categoriesErrorObj}
            isEmpty={categories.length === 0}
            emptyTitle="Belum ada kategori"
            emptyHint="Kategori akan muncul setelah admin menambahkan produk."
            onRetry={() => refetchCategories()}
          >
            <FeaturedCategoriesMega featuredCategories={featuredCategories} />
          </QueryState>
        </section>

        <section>
          <QueryState
            isLoading={popularLoading}
            isError={popularError}
            error={popularErrorObj}
            isEmpty={popularProducts.length === 0}
            emptyTitle="Produk belum tersedia"
            emptyHint="Produk populer akan muncul setelah katalog diisi."
            onRetry={() => refetchPopular()}
          >
            <div className="flex items-center justify-end">
              <Link
                to="/search"
                className="hidden sm:inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
              >
                Shop all
              </Link>
            </div>
            <PopularProductsGrid safeProducts={popularProducts} ProductCard={ProductCard} />
            <div className="mt-8 flex justify-center">
              <Link
                to="/search"
                className="inline-flex items-center rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
              >
                Shop all products
              </Link>
            </div>
          </QueryState>
        </section>
      </div>
    </div>
  );
}
