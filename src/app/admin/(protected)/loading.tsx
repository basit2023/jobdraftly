export default function AdminLoading() {
  return (
    <div aria-label="Loading administrator page" className="animate-pulse space-y-6" role="status">
      <div className="h-14 w-72 rounded-2xl bg-slate-200" />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <div className="h-32 rounded-2xl bg-white" key={index} />)}
      </div>
      <div className="h-96 rounded-2xl bg-white" />
    </div>
  );
}
