import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCartStore } from "../../store/cart.store.ts";
import { useCategories, useProducts, ProductCard } from "../../storefront.jsx";
import { fetchStoreCoupons } from "../../api/store.service.ts";
import { formatCurrency } from "../../utils/format.js";
import CouponPanel from "../../components/kachabazar-demo/CouponPanel.jsx";
import FloatingCartWidget from "../../components/kachabazar-demo/FloatingCartWidget.jsx";
import FeaturedCategoriesMega from "../../components/kachabazar-demo/FeaturedCategoriesMega.jsx";
import PopularProductsGrid from "../../components/kachabazar-demo/PopularProductsGrid.jsx";
import HomeHeroBanners from "../../components/store/HomeHeroBanners.jsx";

const slides = [
  {
    title: "Quality Freshness Guaranteed",
    subtitle: "Get fresh groceries delivered to your door every day.",
    cta: "Buy Now",
  },
  {
    title: "Organic & Natural Essentials",
    subtitle: "Healthy choices curated for your daily needs.",
    cta: "Shop Now",
  },
  {
    title: "Big Savings for Daily Shopping",
    subtitle: "Discover deals on pantry staples and snacks.",
    cta: "Browse Deals",
  },
];

const dummyCategories = [
  {
    id: 1,
    name: "Fresh Fruits",
    slug: "fresh-fruits",
    icon: "🥬",
    items: ["Apple", "Orange", "Banana"],
  },
  {
    id: 2,
    name: "Fresh Vegetables",
    slug: "fresh-vegetables",
    icon: "🍳",
    items: ["Carrot", "Tomato", "Potato"],
  },
  {
    id: 3,
    name: "Fish & Meat",
    slug: "fish-meat",
    icon: "🐶",
    items: ["Salmon", "Beef", "Chicken"],
  },
  {
    id: 4,
    name: "Milk & Dairy",
    slug: "milk-dairy",
    icon: "🥛",
    items: ["Milk", "Cheese", "Yogurt"],
  },
  {
    id: 5,
    name: "Beverages",
    slug: "beverages",
    icon: "☕",
    items: ["Tea", "Coffee", "Juice"],
  },
  {
    id: 6,
    name: "Bread & Bakery",
    slug: "bread-bakery",
    icon: "🍩",
    items: ["Bread", "Cake", "Cookies"],
  },
  {
    id: 7,
    name: "Snacks",
    slug: "snacks",
    icon: "💄",
    items: ["Chips", "Nuts", "Chocolate"],
  },
  {
    id: 8,
    name: "Household",
    slug: "household",
    icon: "🧼",
    items: ["Cleaner", "Tissue", "Soap"],
  },
];

const dummyProducts = [
  { id: 101, name: "Organic Banana", slug: "organic-banana", price: 12000, category: { name: "Fruits" } },
  { id: 102, name: "Fresh Tomato", slug: "fresh-tomato", price: 8000, category: { name: "Vegetables" } },
  { id: 103, name: "Brown Bread", slug: "brown-bread", price: 15000, category: { name: "Bakery" } },
  { id: 104, name: "Milk 1L", slug: "milk-1l", price: 18000, category: { name: "Dairy" } },
  { id: 105, name: "Chicken Breast", slug: "chicken-breast", price: 42000, category: { name: "Meat" } },
  { id: 106, name: "Orange Juice", slug: "orange-juice", price: 22000, category: { name: "Beverages" } },
  { id: 107, name: "Potato Chips", slug: "potato-chips", price: 14000, category: { name: "Snacks" } },
  { id: 108, name: "Green Apple", slug: "green-apple", price: 16000, category: { name: "Fruits" } },
];

const dummyCoupons = [
  { id: 1, code: "SAVE10", label: "Save 10% on min 100K" },
  { id: 2, code: "MIN50K", label: "Save 15K for min 50K" },
  { id: 3, code: "WELCOME", label: "New user 5% off" },
];

export default function KachaBazarDemoHomePage() {
  const totalQty = useCartStore((state) => state.totalQty);
  const subtotal = useCartStore((state) => state.subtotal);
  const { data: categoriesData } = useCategories();
  const {
    data: productsData,
    isLoading,
    isError,
  } = useProducts({ page: 1, limit: 10 });
  const categories = categoriesData?.data?.items ?? [];
  const categoriesById = useMemo(() => {
    const map = new Map();
    (categories || []).forEach((category) => {
      if (category?.id != null) {
        map.set(Number(category.id), category);
      }
    });
    return map;
  }, [categories]);
  const rawProductsCandidate =
    productsData?.data?.items ??
    productsData?.data?.products ??
    productsData?.data?.data ??
    productsData?.data ??
    productsData?.items ??
    productsData?.products ??
    [];
  const rawProducts = Array.isArray(rawProductsCandidate) ? rawProductsCandidate : [];

  const [activeSlide, setActiveSlide] = useState(0);
  const [copiedCode, setCopiedCode] = useState("");
  const [coupons, setCoupons] = useState([]);
  const [couponError, setCouponError] = useState("");

  useEffect(() => {
    let mounted = true;
    const loadCoupons = async () => {
      try {
        const response = await fetchStoreCoupons();
        if (!mounted) return;
        setCoupons(response.data || []);
      } catch (err) {
        if (!mounted) return;
        setCouponError("Failed to load coupons.");
      }
    };
    loadCoupons();
    return () => {
      mounted = false;
    };
  }, []);

  const featuredCategories =
    categories.length > 0
      ? categories.map((category, index) => ({
          ...category,
          icon: dummyCategories[index % dummyCategories.length]?.icon || "🥬",
          items: dummyCategories[index % dummyCategories.length]?.items || [
            "Item one",
            "Item two",
            "Item three",
          ],
        }))
      : dummyCategories;
  const popularProducts = rawProducts.length > 0 ? rawProducts : dummyProducts;
  const couponList =
    coupons.length > 0
      ? coupons.map((coupon) => ({
          id: coupon.id,
          code: coupon.code,
          label: `${coupon.code} - ${
            coupon.discountType === "percent"
              ? `${coupon.amount}% off`
              : `${formatCurrency(Number(coupon.amount || 0))} off`
          }`,
        }))
      : dummyCoupons;

  const subtotalDisplay = useMemo(
    () =>
      Number.isFinite(Number(subtotal))
        ? formatCurrency(Number(subtotal || 0))
        : formatCurrency(0),
    [subtotal]
  );

  const safeProducts = useMemo(
    () =>
      popularProducts.map((raw) => {
        const title = raw?.title ?? raw?.name ?? "";
        const price = Number(raw?.price ?? raw?.sellingPrice ?? raw?.salePrice ?? 0);
        const categoryObj =
          raw?.category ??
          raw?.Category ??
          (raw?.categoryId != null ? categoriesById.get(Number(raw.categoryId)) : null) ??
          (raw?.categoryName ? { name: raw.categoryName } : null) ??
          { name: "Uncategorized" };
        const imageUrl = raw?.promoImagePath ?? raw?.imageUrl ?? raw?.image ?? null;
        const slug = raw?.slug ?? String(raw?.id ?? "");

        return {
          id: raw?.id,
          title,
          name: raw?.name ?? title,
          price,
          salePrice: raw?.salePrice ?? null,
          category: categoryObj,
          imageUrl,
          image: imageUrl,
          slug,
        };
      }),
    [popularProducts, categoriesById]
  );

  const handleCopyCoupon = async (code) => {
    if (!code) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = code;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(""), 1500);
    } catch (err) {
      setCopiedCode("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-7xl space-y-16 px-4 py-10">
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-8">
              <HomeHeroBanners
                slides={slides}
                activeSlide={activeSlide}
                setActiveSlide={setActiveSlide}
                promoClassName="lg:hidden"
              />
            </div>
            <div className="hidden lg:col-span-4 lg:block">
              <CouponPanel
                couponList={couponList}
                couponError={couponError}
                copiedCode={copiedCode}
                onCopy={handleCopyCoupon}
              />
            </div>
          </div>
          <article className="relative hidden overflow-hidden rounded-2xl border border-[#f1d2b3] bg-[#FDEEDC] p-6 shadow-sm lg:block">
            <div className="max-w-[70%]">
              <h2 className="text-2xl font-semibold leading-8 text-slate-900">
                100% Natural Quality Organic Product
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                See our latest collection of organic products and healthy groceries for your
                family.
              </p>
            </div>
            <Link
              to="/search?query=organic"
              className="absolute right-8 top-1/2 inline-flex h-20 w-20 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-700"
            >
              <span className="text-center leading-[1.1rem]">
                Buy
                <br />
                Now
              </span>
            </Link>
          </article>
        </section>

        <FloatingCartWidget totalQty={totalQty} subtotalDisplay={subtotalDisplay} />

        <FeaturedCategoriesMega featuredCategories={featuredCategories} />
        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading products...
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
            Failed to load products.
          </div>
        ) : (
          <PopularProductsGrid safeProducts={safeProducts} ProductCard={ProductCard} />
        )}
      </main>
    </div>
  );
}
