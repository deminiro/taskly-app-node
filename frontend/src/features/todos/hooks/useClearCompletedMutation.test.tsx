import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useClearCompletedMutation } from './useClearCompletedMutation'

vi.mock('../api/todos', () => ({ todosApi: { clearCompleted: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, ...renderHook(() => useClearCompletedMutation(), { wrapper }) }
}

it('removes completed tasks from the cached list on success', async () => {
  vi.mocked(todosApi.clearCompleted).mockResolvedValue({ deleted: 1 })
  const { client, result } = setup()
  const open = { ...todoFixture, id: 1 }
  const done = { ...todoFixture, id: 2, completed: true }
  client.setQueryData(todoKeys.list, [open, done])
  let response
  await act(async () => {
    response = await result.current.mutateAsync()
  })
  expect(response).toEqual({ deleted: 1 })
  expect(client.getQueryData(todoKeys.list)).toEqual([open])
})

it('leaves the cache untouched and exposes the error on failure', async () => {
  vi.mocked(todosApi.clearCompleted).mockRejectedValue(new Error('boom'))
  const { client, result } = setup()
  const done = { ...todoFixture, completed: true }
  client.setQueryData(todoKeys.list, [done])
  await act(async () => {
    await result.current.mutateAsync().catch(() => undefined)
  })
  expect(client.getQueryData(todoKeys.list)).toEqual([done])
  await waitFor(() => expect(result.current.error).toEqual(new Error('boom')))
})

it('does not create a cache entry when the list was never loaded', async () => {
  vi.mocked(todosApi.clearCompleted).mockResolvedValue({ deleted: 0 })
  const { client, result } = setup()
  await act(async () => {
    await result.current.mutateAsync()
  })
  expect(client.getQueryData(todoKeys.list)).toBeUndefined()
})
