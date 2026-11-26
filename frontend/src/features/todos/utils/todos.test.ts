import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

  it('keeps only completed tasks for the completed filter', () => {
    const done = { ...base, id: 2, completed: true }
    expect(selectTodos([base, done], 'completed', '', 'newest')).toEqual([done])
  })

  it('sorts newest first, breaking ties by higher id', () => {
    const older = { ...base, id: 3, created_at: '2026-09-01T12:00:00Z' }
    const sameTime = { ...base, id: 2 }
    expect(selectTodos([older, base, sameTime], 'all', '', 'newest')).toEqual([
      sameTime,
      base,
      older,
    ])
  })

  it('sorts by due date with undated tasks last, breaking ties by id', () => {
    const soon = { ...base, id: 2, due_date: '2026-10-02' }
    const later = { ...base, id: 3, due_date: '2026-12-01' }
    const undated = { ...base, id: 4 }
    expect(selectTodos([undated, base, later, soon], 'all', '', 'due')).toEqual(
      [soon, later, undated, base],
    )
  })

  it('breaks priority ties by higher id', () => {
    const low: Todo = { ...base, id: 5, priority: 'low' }
    const medium = { ...base, id: 2 }
    expect(selectTodos([low, base, medium], 'all', '', 'priority')).toEqual([
      medium,
      base,
      low,
    ])
  })
})

describe('validateTodo', () => {
  const input = {
    title: 'Plan',
    description: '',
    priority: 'medium' as const,
    due_date: null,
    completed: false,
  }

  it('accepts a valid task with and without a due date', () => {
    expect(validateTodo(input)).toEqual({})
    expect(validateTodo({ ...input, due_date: '2028-02-29' })).toEqual({})
  })

  it('requires a non-blank title', () => {
    expect(validateTodo({ ...input, title: '   ' })).toEqual({
      title: 'Enter a task title.',
    })
  })

  it('limits the trimmed title to 120 characters', () => {
    expect(validateTodo({ ...input, title: ` ${'a'.repeat(120)} ` })).toEqual(
      {},
    )
    expect(validateTodo({ ...input, title: 'a'.repeat(121) })).toEqual({
      title: 'The title must be at most 120 characters.',
    })
  })

  it('limits the trimmed description to 2000 characters', () => {
    expect(validateTodo({ ...input, description: 'a'.repeat(2001) })).toEqual({
      description: 'The description must be at most 2000 characters.',
    })
  })

  it.each(['2026-1-05', 'not-a-date', '2026-13-01', '2027-02-29'])(
    'rejects the invalid due date %s',
    (due_date) => {
      expect(validateTodo({ ...input, due_date })).toEqual({
        due_date: 'Enter a valid date.',
      })
    },
  )
})

describe('isOverdue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 26, 0, 30))
  })
  afterEach(() => vi.useRealTimers())

  it('is true only for an active task due before the local today', () => {
    expect(isOverdue({ ...base, due_date: '2026-11-25' })).toBe(true)
    expect(isOverdue({ ...base, due_date: '2026-11-26' })).toBe(false)
    expect(isOverdue({ ...base, due_date: null })).toBe(false)
    expect(isOverdue({ ...base, due_date: '2026-11-25', completed: true })).toBe(
      false,
    )
  })
})

describe('formatDate', () => {
  it('formats an ISO date as day, short month and year', () => {
    expect(formatDate('2026-03-05')).toBe('5 Mar 2026')
  })
})
