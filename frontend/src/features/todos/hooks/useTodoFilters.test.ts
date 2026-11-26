import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { useTodoFilters } from './useTodoFilters'

it('starts with defaults and recomputes visible todos on change', () => {
  const done = { ...todoFixture, id: 8, title: 'Done', completed: true }
  const { result } = renderHook(() => useTodoFilters([todoFixture, done]))
  expect(result.current).toMatchObject({
    filter: 'all',
    search: '',
    sort: 'newest',
    visible: [done, todoFixture],
  })
  act(() => result.current.setFilter('completed'))
  expect(result.current.visible).toEqual([done])
  act(() => result.current.setSearch('nothing matches'))
  expect(result.current.visible).toEqual([])
  act(() => result.current.setSort('due'))
  expect(result.current.sort).toBe('due')
})
