import { Outlet } from "react-router-dom";

export default function CatalogLayout() {
  return (
    <section className="space-y-6">
      <Outlet />
    </section>
  );
}