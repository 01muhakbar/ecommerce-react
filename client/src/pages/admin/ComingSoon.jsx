export default function ComingSoon({ title = "Coming Soon" }) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-slate-500">This page is not implemented yet.</p>
    </div>
  );
}
