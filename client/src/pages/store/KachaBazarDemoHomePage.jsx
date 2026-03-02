import { useEffect, useMemo, useState } from "react";
import { useCategories, useProducts } from "../../storefront.jsx";
import { fetchStoreCoupons } from "../../api/store.service.ts";
import { formatCurrency } from "../../utils/format.js";
import CouponPanel from "../../components/kachabazar-demo/CouponPanel.jsx";
import FeatureStrip from "../../components/kachabazar-demo/FeatureStrip.jsx";
import FeaturedCategoriesSection from "../../components/kachabazar-demo/FeaturedCategoriesSection.jsx";
import ProductSection from "../../components/kachabazar-demo/ProductSection.jsx";
import PromoDeliveryBanner from "../../components/kachabazar-demo/PromoDeliveryBanner.jsx";
import DiscountedProductsSection from "../../components/kachabazar-demo/DiscountedProductsSection.jsx";
import HomeHeroBanners from "../../components/store/HomeHeroBanners.jsx";

const slides = [
  {
    title: "Quality Freshness Guaranteed!",
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

const dummyCoupons = [
  {
    id: 1,
    code: "SUMMER24",
    discountLabel: "10% Off",
    title: "Special discount for all grocery products",
    countdown: "00 : 00 : 00 : 00",
    status: "Active",
  },
  {
    id: 2,
    code: "WELCOME",
    discountLabel: `${formatCurrency(100)} Off`,
    title: "Get instant savings for your first checkout",
    countdown: "00 : 00 : 00 : 00",
    status: "Active",
  },
  {
    id: 3,
    code: "SAVE10",
    discountLabel: "10% Off",
    title: "Weekend limited voucher for selected products",
    countdown: "00 : 00 : 00 : 00",
    status: "Inactive",
  },
];

export default function KachaBazarDemoHomePage() {
  const { data: categoriesData } = useCategories();
  const {
    data: productsData,
    isLoading,
    isError,
    refetch: refetchProducts,
  } = useProducts({ page: 1, limit: 30 });
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

  const popularProducts = rawProducts;
  const couponList =
    coupons.length > 0
      ? coupons.map((coupon) => ({
          id: coupon.id,
          code: coupon.code,
          discountLabel:
            coupon.discountType === "percent"
              ? `${coupon.amount}% Off`
              : `${formatCurrency(Number(coupon.amount || 0))} Off`,
          title:
            coupon.discountType === "percent"
              ? `Save up to ${coupon.amount}% on selected items`
              : `Flat savings of ${formatCurrency(Number(coupon.amount || 0))}`,
          countdown: "00 : 00 : 00 : 00",
          status:
            coupon.expiresAt && Number.isFinite(Date.parse(coupon.expiresAt))
              ? Date.parse(coupon.expiresAt) > Date.now()
                ? "Active"
                : "Inactive"
              : "Active",
        }))
      : dummyCoupons;

  const safeProducts = useMemo(
    () =>
      popularProducts.map((raw) => {
        const title = raw?.title ?? raw?.name ?? "";
        const price = Number(raw?.price ?? raw?.sellingPrice ?? raw?.salePrice ?? 0);
        const originalPrice = Number(raw?.originalPrice ?? raw?.price ?? 0);
        const salePrice =
          raw?.salePrice != null ? Number(raw.salePrice) : null;
        const discountPercent = Number(raw?.discountPercent ?? 0);
        const ratingAvg = Number(raw?.ratingAvg ?? raw?.averageRating ?? 0);
        const reviewCount = Number(raw?.reviewCount ?? 0);
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
          originalPrice,
          salePrice,
          discountPercent,
          ratingAvg,
          reviewCount,
          unit: raw?.unit ?? raw?.tags?.unit ?? "1 pc",
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
      <main className="mx-auto max-w-7xl space-y-14 px-4 py-8 md:px-6 lg:py-10">
        <section>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_290px] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div>
              <HomeHeroBanners slides={slides} activeSlide={activeSlide} setActiveSlide={setActiveSlide} />
            </div>
            <div>
              <CouponPanel
                couponList={couponList}
                couponError={couponError}
                copiedCode={copiedCode}
                onCopy={handleCopyCoupon}
              />
            </div>
          </div>
        </section>

        <FeatureStrip />
        <FeaturedCategoriesSection categories={categories} products={safeProducts} />
        <ProductSection
          title="Popular Products for Daily Shopping"
          subtitle="Fresh picks and essentials you can add in one click."
          products={safeProducts}
          categories={categories}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetchProducts()}
        />
        <PromoDeliveryBanner />
        <DiscountedProductsSection
          products={safeProducts}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetchProducts()}
        />
      </main>
    </div>
  );
}
