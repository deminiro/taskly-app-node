import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TodoForm } from './TodoForm'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))

describe('TodoForm', () => {
  it('rejects a whitespace-only title without submitting', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <TodoForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    await user.type(screen.getByLabelText(/Task title/), '   ')
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(screen.getByText('Enter a task title.')).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits trimmed values and the selected priority', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <TodoForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    await user.type(screen.getByLabelText(/Task title/), '  Prepare a demo  ')
    await user.selectOptions(screen.getByLabelText('Priority'), 'high')
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Prepare a demo',
      description: '',
      priority: 'high',
      due_date: null,
      completed: false,
    })
  })
})

describe('TodoForm extras', () => {
  const base = { onSubmit: vi.fn(), onCancel: vi.fn(), busy: false, error: null }
  it('prefills initial values, edits description and due date, and submits', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<TodoForm {...base} onSubmit={onSubmit} initial={{ title: 'A', description: '', priority: 'low', due_date: null, completed: true }} />)
    expect(screen.getByLabelText(/Task title/)).toHaveValue('A')
    await user.type(screen.getByLabelText(/Description/), ' desc ')
    await user.type(screen.getByLabelText(/Due date/), '2026-12-01')
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(onSubmit).toHaveBeenCalledWith({ title: 'A', description: 'desc', priority: 'low', due_date: '2026-12-01', completed: true })
  })
  it('clears the due date back to null', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<TodoForm {...base} onSubmit={onSubmit} initial={{ title: 'A', description: '', priority: 'low', due_date: '2026-12-01', completed: false }} />)
    await user.clear(screen.getByLabelText(/Due date/))
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ due_date: null }))
  })
  it('shows an overlong description error', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TodoForm {...base} onSubmit={onSubmit} initial={{ title: 'A', description: 'x'.repeat(2001), priority: 'low', due_date: null, completed: false }} />)
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(screen.getByText(/at most 2000|2000 characters/)).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
  })
  it('calls onCancel and shows server error', async () => {
    const onCancel = vi.fn()
    render(<TodoForm {...base} onCancel={onCancel} error="Server said no" />)
    expect(screen.getByTestId('alert')).toHaveTextContent('Server said no')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
  it('shows a saving state while busy', () => {
    render(<TodoForm {...base} busy />)
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  })
})
