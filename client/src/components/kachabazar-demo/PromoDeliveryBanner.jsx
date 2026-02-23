import { Link } from "react-router-dom";
import heroBannerImage from "../../assets/admin-login-hero.jpg";

export default function PromoDeliveryBanner() {
  return (
    <section className="rounded-3xl bg-emerald-600 p-4 shadow-[0_18px_38px_-30px_rgba(5,150,105,0.6)] sm:p-6">
      <div className="overflow-hidden rounded-[26px] bg-white p-5 sm:p-7">
        <div className="grid items-center gap-5 lg:grid-cols-2">
          <div>
            <h3 className="text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">
              Get Your Grocery Delivery
              <br />
              Right at Your Doorstep
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Shop fresh products from our KachaBazar demo catalog and enjoy fast delivery with
              daily curated deals.
            </p>
            <div className="mt-5">
              <Link
                to="/search"
                className="inline-flex items-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Shop Now
              </Link>
            </div>
          </div>
          <div className="relative min-h-[180px]">
            <div className="absolute inset-0 rounded-2xl bg-emerald-50" />
            <img
              src={heroBannerImage}
              alt="Delivery promo"
              className="relative z-10 h-full w-full rounded-2xl object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
