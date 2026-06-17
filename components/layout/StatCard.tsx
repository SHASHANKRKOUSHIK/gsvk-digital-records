import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: string | number
  sub?: string
  icon?: React.ReactNode
  iconBg?: string
  trend?: { value: number; label: string }
  className?: string
}

export function StatCard({ label, value, sub, icon, iconBg = 'bg-blue-50', trend, className }: Props) {
  return (
    <div className={cn('bg-white rounded-xl border border-gray-100 shadow-sm p-5', className)}>
      {icon && (
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-3', iconBg)}>
          {icon}
        </div>
      )}
      <p className="text-2xl font-bold text-gray-900">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      <p className="text-sm font-medium text-gray-700 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      {trend && (
        <div className={cn('flex items-center gap-1 text-xs mt-2', trend.value >= 0 ? 'text-green-600' : 'text-red-500')}>
          <span>{trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
          <span className="text-gray-400">{trend.label}</span>
        </div>
      )}
    </div>
  )
}
