import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { PaginatedResponse } from '@/types'

type UseCrudOptions = {
  endpoint: string
  perPage?: number
}

type UseCrudReturn<T> = {
  items: T[]
  pagination: PaginatedResponse<T>['pagination'] | null
  loading: boolean
  error: string | null
  fetchItems: (page?: number, search?: string) => Promise<void>
  createItem: (data: any) => Promise<any>
  updateItem: (id: number, data: any) => Promise<any>
  deleteItem: (id: number) => Promise<void>
  refresh: () => Promise<void>
}

export function useCrud<T>({ endpoint, perPage = 10 }: UseCrudOptions): UseCrudReturn<T> {
  const [items, setItems] = useState<T[]>([])
  const [pagination, setPagination] = useState<PaginatedResponse<T>['pagination'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  const fetchItems = useCallback(async (page = 1, search = '') => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('per_page', String(perPage))
      params.set('page', String(page))
      if (search) params.set('search', search)

      const response: PaginatedResponse<T> = await api.get(`${endpoint}?${params.toString()}`)
      setItems(response.data)
      setPagination(response.pagination)
      setCurrentPage(page)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }, [endpoint, perPage])

  const createItem = async (data: any) => {
    const response = await api.post(endpoint, data)
    await fetchItems(currentPage)
    return response
  }

  const updateItem = async (id: number, data: any) => {
    const response = await api.put(`${endpoint}/${id}`, data)
    await fetchItems(currentPage)
    return response
  }

  const deleteItem = async (id: number) => {
    await api.delete(`${endpoint}/${id}`)
    await fetchItems(currentPage)
  }

  const refresh = useCallback(() => fetchItems(currentPage), [fetchItems, currentPage])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  return { items, pagination, loading, error, fetchItems, createItem, updateItem, deleteItem, refresh }
}
