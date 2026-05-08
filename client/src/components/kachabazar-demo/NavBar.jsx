import { useMemo } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import CategoryAccordion from "../store/CategoryAccordion.jsx";
import { buildCategoryTree } from "../../utils/categoryTree.ts";

const toText = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

export default function NavBar({
  showCategories,
  setShowCategories,
  showPages,
  setShowPages,
  categories,
  categoriesLoading,
  menuLabels = {},
  menuEnabled = {},
}) {
  const navigate = useNavigate();
  const navItemClass = ({ isActive }) =>
    `inline-flex items-center whitespace-nowrap text-[14px] font-medium transition ${
      isActive
        ? "text-slate-900"
        : "text-slate-700 hover:text-emerald-600 hover:underline hover:decoration-1 hover:underline-offset-4"
    }`;
  const offerItemClass = ({ isActive }) =>
    `relative inline-flex items-center whitespace-nowrap pr-2 text-[14px] font-medium transition ${
      isActive
        ? "text-slate-900"
        : "text-slate-700 hover:text-emerald-600 hover:underline hover:decoration-1 hover:underline-offset-4"
    }`;
  const categoryTree = useMemo(() => buildCategoryTree(categories || []), [categories]);
  const categoriesLabel = toText(menuLabels.categories, "Categories");
  const aboutUsLabel = toText(menuLabels.aboutUs, "About Us");
  const contactUsLabel = toText(menuLabels.contactUs, "Contact Us");
  const offersLabel = toText(menuLabels.offers, "Offers");
  const faqLabel = toText(menuLabels.faq, "FAQ");
  const pagesLabel = toText(menuLabels.pages, "Pages");
  const myAccountLabel = toText(menuLabels.myAccount, "My Account");
  const privacyPolicyLabel = toText(menuLabels.privacyPolicy, "Privacy Policy");
  const termsAndConditionsLabel = toText(
    menuLabels.termsAndConditions,
    "Terms & Conditions"
  );
  const showCategoriesMenu = menuEnabled.showCategories !== false;
  const showAboutUsMenu = menuEnabled.showAboutUs !== false;
  const showContactUsMenu = menuEnabled.showContactUs !== false;
  const showOffersMenu = menuEnabled.showOffers !== false;
  const showFaqMenu = menuEnabled.showFaq !== false;
  const showPrivacyPolicyMenu = menuEnabled.showPrivacyPolicy !== false;
  const showTermsMenu = menuEnabled.showTermsAndConditions !== false;
  const pageItems = [
    showAboutUsMenu ? { key: "about-us", to: "/about-us", label: aboutUsLabel } : null,
    showContactUsMenu ? { key: "contact-us", to: "/contact-us", label: contactUsLabel } : null,
    showOffersMenu ? { key: "offers", to: "/offers", label: offersLabel } : null,
    showFaqMenu ? { key: "faq", to: "/faq", label: faqLabel } : null,
    { key: "my-account", to: "/user/my-account", label: myAccountLabel },
  ].filter(Boolean);
  const hasLegalMenuItems = showPrivacyPolicyMenu || showTermsMenu;

  const handleSelectCategory = (node) => {
    const categoryKey = String(node?.code || node?.slug || node?.id || "").trim();
    if (!categoryKey) return;
    setShowCategories(false);
    navigate(`/search?category=${encodeURIComponent(categoryKey)}&page=1`);
  };

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-[56px] w-full max-w-7xl items-center justify-between gap-5 px-4 sm:px-5 lg:px-6">
        <div className="flex min-w-0 items-center gap-5 lg:gap-7">
          {showCategoriesMenu ? (
            <div className="relative" data-demo-dropdown>
              <button
                type="button"
                onClick={() => setShowCategories((prev) => !prev)}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-slate-50/65 px-4 text-[14px] font-medium leading-none text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                {categoriesLabel} <span className="text-[10px] text-slate-500">▾</span>
              </button>
              {showCategories ? (
                <div className="absolute left-0 top-12 z-20 w-80 max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 text-sm shadow-lg">
                  {categoriesLoading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={`categories-loading-${index}`}
                        className="mb-1 h-9 animate-pulse rounded-lg bg-slate-100 last:mb-0"
                      />
                    ))
                  ) : categories.length === 0 ? (
                    <div className="rounded-lg px-3 py-2 text-xs text-slate-500">
                      No categories
                    </div>
                  ) : (
                    <CategoryAccordion
                      nodes={categoryTree}
                      onSelect={handleSelectCategory}
                      defaultExpandedIds={categoryTree.slice(0, 1).map((item) => item.id)}
                    />
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center gap-6 lg:gap-7">
            {showAboutUsMenu ? (
              <NavLink to="/about-us" className={navItemClass}>
                {aboutUsLabel}
              </NavLink>
            ) : null}
            {showContactUsMenu ? (
              <NavLink to="/contact-us" className={navItemClass}>
                {contactUsLabel}
              </NavLink>
            ) : null}
            {pageItems.length > 0 ? (
              <div className="relative" data-demo-dropdown>
                <button
                  type="button"
                  onClick={() => setShowPages((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap text-[14px] font-medium text-slate-700 transition hover:text-emerald-600 hover:underline hover:decoration-1 hover:underline-offset-4"
                >
                  {pagesLabel} <span className="text-[10px] text-slate-500">▾</span>
                </button>
                {showPages ? (
                  <div className="absolute left-0 top-9 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1.5 text-sm shadow-lg">
                    {pageItems.map((item) => (
                      <Link
                        key={item.key}
                        to={item.to}
                        className="block rounded-lg px-3 py-2 hover:bg-slate-50"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {showOffersMenu ? (
              <NavLink to="/offers" className={offerItemClass}>
                {offersLabel}
                <span className="absolute right-0 top-[2px] h-1.5 w-1.5 rounded-full bg-rose-500" />
              </NavLink>
            ) : null}
          </div>
        </div>

        {hasLegalMenuItems ? (
          <div className="hidden shrink-0 items-center gap-5 text-[13px] text-slate-500 lg:flex">
            <span className="whitespace-nowrap">English</span>
            {showPrivacyPolicyMenu ? (
              <Link to="/privacy-policy" className="transition hover:text-emerald-600">
                {privacyPolicyLabel}
              </Link>
            ) : null}
            {showTermsMenu ? (
              <Link to="/terms" className="transition hover:text-emerald-600">
                {termsAndConditionsLabel}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
