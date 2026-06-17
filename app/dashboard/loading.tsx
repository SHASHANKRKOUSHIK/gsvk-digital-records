export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg" />
            <div className="h-6 bg-gray-200 rounded w-16" />
            <div className="h-4 bg-gray-100 rounded w-24" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 h-64" />
        <div className="bg-white rounded-xl border border-gray-100 h-64" />
      </div>
      <div className="bg-white rounded-xl border border-gray-100 h-48" />
    </div>
  )
}
