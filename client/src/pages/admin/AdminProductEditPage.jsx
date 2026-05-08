import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AdminProductDetailPage from "./AdminProductDetailPage.jsx";
import ProductForm from "./ProductForm.jsx";

export default function AdminProductEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        navigate(`/admin/catalog/products/${encodeURIComponent(String(id))}`, { replace: true });
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [id, navigate]);

  const closeToDetail = () => {
    navigate(`/admin/catalog/products/${encodeURIComponent(String(id))}`, { replace: true });
  };

  return (
    <>
      <AdminProductDetailPage />
      <button
        type="button"
        aria-label="Close edit product drawer"
        onClick={closeToDetail}
        className="fixed inset-0 z-40 bg-slate-900/35 backdrop-blur-[1px]"
      />
      <div className="fixed inset-0 z-50 w-screen max-w-full overflow-x-hidden border-l border-slate-200 bg-white shadow-2xl md:left-[280px] md:right-0 md:w-auto">
        <ProductForm
          mode="drawer"
          productId={id}
          onClose={closeToDetail}
          onSuccess={closeToDetail}
        />
      </div>
    </>
  );
}
