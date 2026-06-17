'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Student, PaginatedResult, SearchFilters } from '@/types'

export function useStudents(initialFilters: SearchFilters = {}) {
  const [data, setData] = useState<PaginatedResult<Student>>({
    data: [], total: 0, page: 1, limit: 20, totalPages: 0,
  })
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState(initialFilters)

  const fetch_ = useCallback(async (f: SearchFilters) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (f.query) params.set('q', f.query)
      if (f.className) params.set('class', f.className)
      if (f.academicYear) params.set('year', f.academicYear)
      if (f.gender) params.set('gender', f.gender)
      params.set('page', String(f.page || 1))
      params.set('limit', String(f.limit || 20))

      const res = await window.fetch(`/api/students?${params}`)
      const json = await res.json()
      setData(json)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch_(filters) }, [filters, fetch_])

  return { ...data, loading, filters, setFilters, refetch: () => fetch_(filters) }
}

export function useStudent(id: string) {
  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    fetch(`/api/students/${id}`)
      .then(r => r.json())
      .then(d => { setStudent(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [id])

  return { student, loading, error }
}
