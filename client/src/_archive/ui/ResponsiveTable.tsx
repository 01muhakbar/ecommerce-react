export default function ResponsiveTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative -mx-3 sm:-mx-4 lg:-mx-6">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          {children}
        </table>
      </div>
    </div>
  );
}