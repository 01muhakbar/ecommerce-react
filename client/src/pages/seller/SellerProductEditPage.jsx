import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SellerProductAuthoringPage from "./SellerProductAuthoringPage.jsx";
import SellerProductDetailPage from "./SellerProductDetailPage.jsx";

export default function SellerProductEditPage() {
  const { storeSlug, productId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        navigateToDetail();
      }
    };

    const navigateToDetail = () => {
      const target =
        storeSlug && productId
          ? `/seller/stores/${encodeURIComponent(storeSlug)}/catalog/products/${encodeURIComponent(
              String(productId)
            )}`
          : "/seller/stores";
      navigate(target, { replace: true });
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [navigate, productId, storeSlug]);

  const closeToDetail = () => {
    const target =
      storeSlug && productId
        ? `/seller/stores/${encodeURIComponent(storeSlug)}/catalog/products/${encodeURIComponent(
            String(productId)
          )}`
        : "/seller/stores";
    navigate(target, { replace: true });
  };

  return (
    <>
      <SellerProductDetailPage />
      <button
        type="button"
        aria-label="Close seller product drawer"
        onClick={closeToDetail}
        className="fixed inset-0 z-[80] bg-slate-900/35 backdrop-blur-[1px]"
      />
      <div className="fixed inset-y-0 right-0 z-[90] w-full max-w-full overflow-x-hidden border-l border-slate-200 bg-white shadow-2xl md:left-[252px] md:right-0 md:w-auto">
        <SellerProductAuthoringPage
          mode="edit"
          presentation="drawer"
          onClose={closeToDetail}
          onSuccess={closeToDetail}
        />
      </div>
    </>
  );
}
