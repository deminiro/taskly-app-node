import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { TodoItem } from './TodoItem'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))

it('shows an active task and forwards edit requests', async () => {
  const user = userEvent.setup()
  const onEdit = vi.fn()
  const onToggle = vi.fn()
  const onDelete = vi.fn()
  render(
    <TodoItem
      todo={todoFixture}
      busy={false}
      onEdit={onEdit}
      onToggle={onToggle}
      onDelete={onDelete}
    />,
  )
  expect(screen.getByRole('heading', { name: todoFixture.title })).toBeVisible()
  expect(screen.getByText('To do')).toBeVisible()
  expect(screen.getByText('Medium')).toBeVisible()
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  await user.click(
    screen.getByRole('button', { name: `Edit: ${todoFixture.title}` }),
  )
  expect(onEdit).toHaveBeenCalledTimes(1)
  expect(onToggle).not.toHaveBeenCalled()
  expect(onDelete).not.toHaveBeenCalled()
})

it('shows a completed task with description and forwards toggle and delete', async () => {
  const user = userEvent.setup()
  const onToggle = vi.fn()
  const onDelete = vi.fn()
  const todo = { ...todoFixture, completed: true, description: 'Some details' }
  render(<TodoItem todo={todo} busy={false} onEdit={vi.fn()} onToggle={onToggle} onDelete={onDelete} />)
  expect(screen.getByText('Completed')).toBeVisible()
  expect(screen.getByText('Some details')).toBeVisible()
  expect(screen.getByRole('checkbox', { name: `Mark as active: ${todo.title}` })).toBeChecked()
  await user.click(screen.getByRole('checkbox'))
  await user.click(screen.getByRole('button', { name: `Delete: ${todo.title}` }))
  expect(onToggle).toHaveBeenCalledTimes(1)
  expect(onDelete).toHaveBeenCalledTimes(1)
})
it('disables actions while busy', () => {
  render(<TodoItem todo={todoFixture} busy onEdit={vi.fn()} onToggle={vi.fn()} onDelete={vi.fn()} />)
  expect(screen.getByRole('checkbox')).toBeDisabled()
  expect(screen.getByRole('button', { name: `Edit: ${todoFixture.title}` })).toBeDisabled()
})
it('marks an overdue task and shows a formatted date for a future one', () => {
  const { rerender } = render(<TodoItem todo={{ ...todoFixture, due_date: '2000-01-01' }} busy={false} onEdit={vi.fn()} onToggle={vi.fn()} onDelete={vi.fn()} />)
  expect(screen.getByText(/1 Jan 2000 · overdue/)).toBeVisible()
  rerender(<TodoItem todo={{ ...todoFixture, due_date: '2999-01-01' }} busy={false} onEdit={vi.fn()} onToggle={vi.fn()} onDelete={vi.fn()} />)
  expect(screen.getByText('1 Jan 2999')).toBeVisible()
})
