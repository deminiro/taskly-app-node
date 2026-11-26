import { useMutation } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it } from 'vitest'
import { createQueryWrapper } from '../../../test/queryWrapper'
import { todoKeys } from '../api/queryKeys'
import { useTodosBusy } from './useTodosBusy'

it('is true only while a todo mutation runs', async () => {
  const { wrapper } = createQueryWrapper()
  let finish!: () => void
  const { result } = renderHook(
    () => ({
      busy: useTodosBusy(),
      mutation: useMutation({
        mutationKey: todoKeys.update,
        mutationFn: () => new Promise<void>((resolve) => (finish = resolve)),
      }),
    }),
    { wrapper },
  )
  expect(result.current.busy).toBe(false)
  act(() => result.current.mutation.mutate())
  await waitFor(() => expect(result.current.busy).toBe(true))
  await act(async () => finish())
  await waitFor(() => expect(result.current.busy).toBe(false))
})

it('ignores mutations outside the todos key', async () => {
  const { wrapper } = createQueryWrapper()
  const { result } = renderHook(
    () => ({
      busy: useTodosBusy(),
      mutation: useMutation({
        mutationKey: ['profile'],
        mutationFn: () => new Promise<void>(() => {}),
      }),
    }),
    { wrapper },
  )
  act(() => result.current.mutation.mutate())
  await waitFor(() => expect(result.current.mutation.isPending).toBe(true))
  expect(result.current.busy).toBe(false)
})
