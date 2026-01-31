export default function Forbidden() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-2 text-sm text-slate-600">
      <h1 className="text-lg font-semibold text-slate-800">Access restricted</h1>
      <p>Limited access for this account.</p>
    </div>
  );
}
