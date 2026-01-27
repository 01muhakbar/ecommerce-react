import { Link } from "react-router-dom";
import { useCategories, useProducts, CategoryCard, ProductCard } from "../../storefront.jsx";

export default function StoreHomePage() {
  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    isError: categoriesError,
  } = useCategories();
  const {
    data: popularData,
    isLoading: popularLoading,
    isError: popularError,
  } = useProducts({ page: 1, limit: 8 });
  const {
    data: latestData,
    isLoading: latestLoading,
    isError: latestError,
  } = useProducts({ page: 1, limit: 8 });

  const categories = categoriesData?.data?.items ?? [];
  const popularProducts = popularData?.data?.items ?? [];
  const latestProducts = latestData?.data?.items ?? [];

  const loading = categoriesLoading || popularLoading || latestLoading;
  const error = categoriesError || popularError || latestError;

  if (loading) {
    return <p className="text-sm text-slate-500">Loading storefront...</p>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        Failed to load storefront data.
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <section className="rounded-3xl bg-gradient-to-br from-amber-50 via-white to-slate-50 p-8">
        <div className="max-w-xl space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">KachaBazaar</p>
          <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">
            Groceries, lifestyle, and everything fresh in one place.
          </h1>
          <p className="text-sm text-slate-600">
            Browse the latest arrivals and curated categories to kick-start your
            daily essentials.
          </p>
          <Link
            to="/search"
            className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
          >
            Browse catalog
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Featured Categories</h2>
          <Link to="/search" className="text-sm text-slate-500 hover:text-slate-900">
            View all
          </Link>
        </div>
        {categories.length === 0 ? (
          <p className="text-sm text-slate-500">No categories available.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Popular Products</h2>
          <Link
            to="/search"
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            Shop all
          </Link>
        </div>
        {popularProducts.length === 0 ? (
          <p className="text-sm text-slate-500">No products available.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {popularProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Latest Products</h2>
          <Link to="/search" className="text-sm text-slate-500 hover:text-slate-900">
            Discover more
          </Link>
        </div>
        {latestProducts.length === 0 ? (
          <p className="text-sm text-slate-500">No products available.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {latestProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}