export default function PopularProductsGrid({ safeProducts, ProductCard }) {
  return (
    <section className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">Popular Products for Daily Shopping</h2>
        <p className="mt-2 text-sm text-slate-500">
          Everyday essentials curated for your cart
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {safeProducts.map((product, index) => (
          <ProductCard
            key={`${product.id ?? product.slug ?? "product"}-${index}`}
            product={product}
          />
        ))}
      </div>
    </section>
  );
}
