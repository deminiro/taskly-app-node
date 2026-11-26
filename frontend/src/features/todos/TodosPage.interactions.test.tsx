import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../test/todoFixture'
import { useNotice } from '../../hooks/useNotice'
import { useClearCompletedMutation } from './hooks/useClearCompletedMutation'
import { useTodoFilters } from './hooks/useTodoFilters'
import { useTodosBusy } from './hooks/useTodosBusy'
import { useTodosQuery } from './hooks/useTodosQuery'
import { useUpdateTodoMutation } from './hooks/useUpdateTodoMutation'
import { TodosPage } from './TodosPage'

vi.mock('../../design-system', () => import('../../design-system/mocks'))
vi.mock('../../hooks/useNotice', () => ({ useNotice: vi.fn() }))
vi.mock('./hooks/useClearCompletedMutation', () => ({ useClearCompletedMutation: vi.fn() }))
vi.mock('./hooks/useTodoFilters', () => ({ useTodoFilters: vi.fn() }))
vi.mock('./hooks/useTodosBusy', () => ({ useTodosBusy: vi.fn() }))
vi.mock('./hooks/useTodosQuery', () => ({ useTodosQuery: vi.fn() }))
vi.mock('./hooks/useUpdateTodoMutation', () => ({ useUpdateTodoMutation: vi.fn() }))
vi.mock('./components/TodosHeader', () => ({
  TodosHeader: ({ onCreate, disabled }: { onCreate: () => void; disabled: boolean }) => (
    <button disabled={disabled} onClick={onCreate}>Create</button>
  ),
}))
vi.mock('./components/TodoFilters', () => ({ TodoFilters: () => null }))
vi.mock('./components/TodoList', () => ({
  TodoList: (p: { todos: unknown[]; onToggle: (t: typeof todoFixture) => void; onEdit: (t: typeof todoFixture) => void; onDelete: (t: typeof todoFixture) => void }) => (
    <div>
      <button onClick={() => p.onToggle(todoFixture)}>toggle</button>
      <button onClick={() => p.onEdit(todoFixture)}>edit</button>
      <button onClick={() => p.onDelete(todoFixture)}>delete</button>
    </div>
  ),
}))
vi.mock('./components/TodoEditor', () => ({
  TodoEditor: ({ todo, onClose, onSaved }: { todo: unknown; onClose: () => void; onSaved: (m: string) => void }) => (
    <div role="dialog" aria-label="editor">
      <span>{todo === 'new' ? 'new' : 'existing'}</span>
      <button onClick={onClose}>close editor</button>
      <button onClick={() => onSaved('Saved!')}>save editor</button>
    </div>
  ),
}))
vi.mock('./components/DeleteTodoDialog', () => ({
  DeleteTodoDialog: ({ onClose, onDeleted }: { onClose: () => void; onDeleted: () => void }) => (
    <div role="dialog" aria-label="delete">
      <button onClick={onClose}>close delete</button>
      <button onClick={onDeleted}>confirm delete</button>
    </div>
  ),
}))
vi.mock('../../components/SuccessNotice', () => ({ SuccessNotice: () => null }))

const notify = vi.fn()
const mutateAsync = vi.fn()

function setup({ busy = false, mutationError = null as Error | null } = {}) {
  vi.mocked(useTodosQuery).mockReturnValue({
    data: [todoFixture], isPending: false, isFetching: false, isError: false, error: null, refetch: vi.fn(),
  } as unknown as ReturnType<typeof useTodosQuery>)
  vi.mocked(useClearCompletedMutation).mockReturnValue({
    error: null, reset: vi.fn(), mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useClearCompletedMutation>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    error: mutationError, reset: vi.fn(), mutateAsync,
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  vi.mocked(useTodosBusy).mockReturnValue(busy)
  vi.mocked(useNotice).mockReturnValue({ message: '', notify })
  vi.mocked(useTodoFilters).mockReturnValue({
    filter: 'all', search: '', sort: 'newest', visible: [todoFixture],
    setFilter: vi.fn(), setSearch: vi.fn(), setSort: vi.fn(),
  })
  render(<TodosPage />)
}

beforeEach(() => vi.clearAllMocks())

it.each([
  [true, 'Another task complete. Well done!'],
  [false, 'Task marked as active.'],
])('toggles completion and notifies (completed=%s)', async (completed, message) => {
  mutateAsync.mockResolvedValue({ ...todoFixture, completed })
  setup()
  await userEvent.click(screen.getByText('toggle'))
  expect(mutateAsync).toHaveBeenCalledWith({ id: todoFixture.id, input: { completed: !todoFixture.completed } })
  await waitFor(() => expect(notify).toHaveBeenCalledWith(message))
})
it('does not toggle while busy', async () => {
  setup({ busy: true })
  await userEvent.click(screen.getByText('toggle'))
  expect(mutateAsync).not.toHaveBeenCalled()
})
it('swallows toggle failures without notifying and shows the error alert', async () => {
  mutateAsync.mockRejectedValue(new Error('fail'))
  setup({ mutationError: new Error('Toggle failed') })
  await userEvent.click(screen.getByText('toggle'))
  await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
  expect(notify).not.toHaveBeenCalled()
  expect(screen.getByTestId('alert')).toHaveTextContent('Toggle failed')
})
it('opens the editor for a new task, then closes it', async () => {
  setup()
  await userEvent.click(screen.getByText('Create'))
  expect(screen.getByText('new')).toBeVisible()
  await userEvent.click(screen.getByText('close editor'))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
it('opens the editor for an existing task and notifies when saved', async () => {
  setup()
  await userEvent.click(screen.getByText('edit'))
  expect(screen.getByText('existing')).toBeVisible()
  await userEvent.click(screen.getByText('save editor'))
  expect(notify).toHaveBeenCalledWith('Saved!')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
it('opens the delete dialog, can cancel, and notifies on delete', async () => {
  setup()
  await userEvent.click(screen.getByText('delete'))
  await userEvent.click(screen.getByText('close delete'))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await userEvent.click(screen.getByText('delete'))
  await userEvent.click(screen.getByText('confirm delete'))
  expect(notify).toHaveBeenCalledWith('Task deleted.')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
