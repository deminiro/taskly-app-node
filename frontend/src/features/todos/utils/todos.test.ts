import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatDate, isOverdue, selectTodos, validateTodo } from './todos'
import type { Todo } from '../types'

const base: Todo = {
  id: 1,
  title: 'Sprint plan',
  description: '',
  priority: 'medium',
  completed: false,
  due_date: null,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
}

describe('selectTodos', () => {
  it('combines status with a case-insensitive search in the description', () => {
    const matching = { ...base, description: 'Discuss the API' }
    const todos = [
      matching,
      { ...matching, id: 2, completed: true },
      { ...base, id: 3 },
    ]
    expect(selectTodos(todos, 'active', ' api ', 'newest')).toEqual([matching])
  })

  it('sorts by priority without changing the source array', () => {
    const high: Todo = { ...base, id: 2, priority: 'high' }
    const todos = [base, high]
    expect(selectTodos(todos, 'all', '', 'priority')).toEqual([high, base])
    expect(todos).toEqual([base, high])
  })
})

describe('selectTodos ordering and filters', () => {
  it('filters completed tasks', () => {
    const done = { ...base, id: 2, completed: true }
    expect(selectTodos([base, done], 'completed', '', 'newest')).toEqual([done])
  })
  it('sorts by due date with undated tasks last, then by id', () => {
    const a = { ...base, id: 1, due_date: '2026-12-01' }
    const b = { ...base, id: 2, due_date: '2026-11-01' }
    const c = { ...base, id: 3 }
    expect(selectTodos([c, a, b], 'all', '', 'due').map((t) => t.id)).toEqual([2, 1, 3])
    const d = { ...base, id: 4 }
    expect(selectTodos([c, d], 'all', '', 'due').map((t) => t.id)).toEqual([4, 3])
  })
  it('breaks priority ties by id descending', () => {
    const other = { ...base, id: 2 }
    expect(selectTodos([base, other], 'all', '', 'priority').map((t) => t.id)).toEqual([2, 1])
  })
  it('sorts newest first by creation time, then id', () => {
    const newer = { ...base, id: 2, created_at: '2026-10-02T12:00:00Z' }
    const same = { ...base, id: 3 }
    expect(selectTodos([base, newer, same], 'all', '', 'newest').map((t) => t.id)).toEqual([2, 3, 1])
  })
})

describe('validateTodo', () => {
  const input = { title: 'Ok', description: '', priority: 'low' as const, due_date: null, completed: false }
  it('accepts a valid task', () => expect(validateTodo(input)).toEqual({}))
  it('requires a title', () => expect(validateTodo({ ...input, title: '  ' }).title).toBe('Enter a task title.'))
  it('limits title and description length', () => {
    const errors = validateTodo({ ...input, title: 'x'.repeat(121), description: 'y'.repeat(2001) })
    expect(errors.title).toMatch(/120/)
    expect(errors.description).toMatch(/2000/)
  })
  it.each(['2026-02-30', 'tomorrow', '2026-1-1'])('rejects due date %s', (due_date) => {
    expect(validateTodo({ ...input, due_date }).due_date).toBe('Enter a valid date.')
  })
  it('accepts a valid due date', () => expect(validateTodo({ ...input, due_date: '2026-02-28' })).toEqual({}))
})

describe('isOverdue and formatDate', () => {
  afterEach(() => vi.useRealTimers())
  it('flags only past, uncompleted tasks with a due date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 15, 12))
    expect(isOverdue({ ...base, due_date: '2026-11-14' })).toBe(true)
    expect(isOverdue({ ...base, due_date: '2026-11-15' })).toBe(false)
    expect(isOverdue({ ...base, due_date: '2026-11-14', completed: true })).toBe(false)
    expect(isOverdue(base)).toBe(false)
  })
  it('formats dates in en-GB', () => expect(formatDate('2026-10-05')).toBe('5 Oct 2026'))
})
