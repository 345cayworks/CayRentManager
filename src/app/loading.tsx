export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-brand-navy"
          aria-hidden="true"
        />
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    </div>
  );
}
