import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { TodoList } from './TodoList'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))
vi.mock('./TodoEmptyState', () => ({
  TodoEmptyState: () => <p>Empty task list</p>,
}))
vi.mock('./TodoItem', () => ({ TodoItem: () => <li>Task</li> }))

it('shows loading feedback before showing an empty list', () => {
  const props = {
    todos: [],
    hasTodos: false,
    failed: false,
    busy: false,
    onCreate: vi.fn(),
    onToggle: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  }
  const { rerender } = render(<TodoList {...props} loading />)
  expect(screen.getByRole('status')).toHaveTextContent('Loading your tasks…')
  expect(screen.queryByText('Empty task list')).not.toBeInTheDocument()
  rerender(<TodoList {...props} loading={false} />)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByText('Empty task list')).toBeVisible()
})

it('shows an unavailable message when loading failed with no tasks', () => {
  render(<TodoList todos={[]} hasTodos={false} loading={false} failed busy={false}
    onCreate={vi.fn()} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />)
  expect(screen.getByRole('heading', { name: 'The task list is temporarily unavailable' })).toBeVisible()
})
it('renders one item per task even when a refresh failed', () => {
  const t = (id: number) => ({ ...todoFixture, id })
  render(<TodoList todos={[t(1), t(2)]} hasTodos loading={false} failed busy={false}
    onCreate={vi.fn()} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />)
  expect(screen.getAllByText('Task')).toHaveLength(2)
})
