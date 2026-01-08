export default function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b">
      <div className="max-w-screen-2xl mx-auto h-14 flex items-center gap-2 px-3 sm:px-4 lg:px-6">
        <button className="lg:hidden rounded p-2 hover:bg-slate-100 focus:outline-none focus:ring" onClick={onMenuClick} aria-label="Open sidebar">≡</button>
        <div className="flex-1 min-w-0">
          <input placeholder="Search..." className="w-full min-w-0 rounded-full border px-4 py-2 text-sm focus:outline-none focus:ring" />
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button className="rounded p-2 hover:bg-slate-100 focus:ring">🔔</button>
          <button className="rounded-full h-8 w-8 bg-emerald-600 text-white">A</button>
        </div>
      </div>
    </header>
  );
}