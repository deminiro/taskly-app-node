import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useCreateTodoMutation } from './useCreateTodoMutation'
import { useDeleteTodoMutation } from './useDeleteTodoMutation'
import { useTodoFilters } from './useTodoFilters'
import { useTodosBusy } from './useTodosBusy'
import { useTodosQuery } from './useTodosQuery'
import { useUpdateTodoMutation } from './useUpdateTodoMutation'

vi.mock('../api/todos', () => ({
  todosApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}))

let client: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
)
const other = { ...todoFixture, id: 8, title: 'Other' }

beforeEach(() => {
  vi.clearAllMocks()
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

it('loads tasks with the abort signal', async () => {
  vi.mocked(todosApi.list).mockResolvedValue([todoFixture])
  const { result } = renderHook(() => useTodosQuery(), { wrapper })
  await waitFor(() => expect(result.current.data).toEqual([todoFixture]))
  expect(todosApi.list).toHaveBeenCalledWith(expect.any(AbortSignal))
})

it('prepends a created task without duplicating it', async () => {
  client.setQueryData(todoKeys.list, [other, todoFixture])
  vi.mocked(todosApi.create).mockResolvedValue(todoFixture)
  const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
  await act(() => result.current.mutateAsync(todoFixture))
  expect(client.getQueryData(todoKeys.list)).toEqual([todoFixture, other])
})

it('creates into an empty cache', async () => {
  vi.mocked(todosApi.create).mockResolvedValue(todoFixture)
  const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
  await act(() => result.current.mutateAsync(todoFixture))
  expect(client.getQueryData(todoKeys.list)).toEqual([todoFixture])
})

it('replaces an updated task in the cache', async () => {
  const saved = { ...todoFixture, completed: true }
  client.setQueryData(todoKeys.list, [todoFixture, other])
  vi.mocked(todosApi.update).mockResolvedValue(saved)
  const { result } = renderHook(() => useUpdateTodoMutation(), { wrapper })
  await act(() => result.current.mutateAsync({ id: 7, input: { completed: true } }))
  expect(todosApi.update).toHaveBeenCalledWith(7, { completed: true })
  expect(client.getQueryData(todoKeys.list)).toEqual([saved, other])
})

it('removes a deleted task from the cache', async () => {
  client.setQueryData(todoKeys.list, [todoFixture, other])
  vi.mocked(todosApi.remove).mockResolvedValue(undefined)
  const { result } = renderHook(() => useDeleteTodoMutation(), { wrapper })
  await act(() => result.current.mutateAsync(7))
  expect(client.getQueryData(todoKeys.list)).toEqual([other])
})

it('keeps the cache untouched when the mutation fails', async () => {
  client.setQueryData(todoKeys.list, [todoFixture])
  vi.mocked(todosApi.remove).mockRejectedValue(new Error('no'))
  const { result } = renderHook(() => useDeleteTodoMutation(), { wrapper })
  await act(async () => { await result.current.mutateAsync(7).catch(() => {}) })
  expect(client.getQueryData(todoKeys.list)).toEqual([todoFixture])
})

it('reports busy while any todo mutation is running', async () => {
  let release!: () => void
  vi.mocked(todosApi.remove).mockReturnValue(new Promise<void>((r) => { release = r }))
  const { result } = renderHook(() => ({ busy: useTodosBusy(), del: useDeleteTodoMutation() }), { wrapper })
  expect(result.current.busy).toBe(false)
  act(() => { void result.current.del.mutateAsync(7) })
  await waitFor(() => expect(result.current.busy).toBe(true))
  await act(async () => release())
  await waitFor(() => expect(result.current.busy).toBe(false))
})

it('filters and sorts through state setters', () => {
  const done = { ...other, completed: true }
  const { result } = renderHook(() => useTodoFilters([todoFixture, done]))
  expect(result.current.visible.map((t) => t.id)).toEqual([8, 7])
  act(() => result.current.setFilter('completed'))
  expect(result.current.visible).toEqual([done])
  act(() => { result.current.setFilter('all'); result.current.setSearch('prepare') })
  expect(result.current.visible).toEqual([todoFixture])
  act(() => result.current.setSort('due'))
  expect(result.current.sort).toBe('due')
})
