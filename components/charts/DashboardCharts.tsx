'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

interface Props {
  byYear: { year: string; count: number }[]
  byClass: { className: string; count: number }[]
}

const COLORS = ['#1E40AF', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#1D4ED8', '#2563EB', '#6366F1', '#8B5CF6', '#A78BFA', '#4F46E5', '#7C3AED']

export default function DashboardCharts({ byYear, byClass }: Props) {
  const classData = byClass.map(r => ({
    name: r.className === 'Nursery' ? 'Nur' : r.className === 'LKG' ? 'LKG' : r.className === 'UKG' ? 'UKG' : `Cls ${r.className}`,
    count: r.count,
  }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Admissions per year */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 mb-4 text-sm">Admissions Per Year</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byYear} margin={{ top: 4, right: 8, bottom: 24, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 9, fill: '#6B7280' }}
              angle={-45}
              textAnchor="end"
              interval={2}
            />
            <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
              formatter={(v: number) => [v, 'Students']}
            />
            <Bar dataKey="count" fill="#1E40AF" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Students per class */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 mb-4 text-sm">Students By Class</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <Pie
                data={classData}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={70}
                label={false}
                labelLine={false}
              >
              {classData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
              formatter={(v: number) => [v, 'Students']}
            />
            <Legend
              iconSize={10}
              wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
              formatter={(value, entry) => `${value}: ${(entry.payload as { count: number }).count}`}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
