import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { useNotice } from '../../hooks/useNotice'
import { todoFixture } from '../../test/todoFixture'
import { useTodoFilters } from './hooks/useTodoFilters'
import { useTodosBusy } from './hooks/useTodosBusy'
import { useTodosQuery } from './hooks/useTodosQuery'
import { useUpdateTodoMutation } from './hooks/useUpdateTodoMutation'
import { TodosPage } from './TodosPage'
import type { Todo } from './types'

vi.mock('../../design-system', () => import('../../design-system/mocks'))
vi.mock('../../hooks/useNotice', () => ({ useNotice: vi.fn() }))
vi.mock('./hooks/useTodoFilters', () => ({ useTodoFilters: vi.fn() }))
vi.mock('./hooks/useTodosBusy', () => ({ useTodosBusy: vi.fn() }))
vi.mock('./hooks/useTodosQuery', () => ({ useTodosQuery: vi.fn() }))
vi.mock('./hooks/useUpdateTodoMutation', () => ({
  useUpdateTodoMutation: vi.fn(),
}))
vi.mock('./components/TodosHeader', () => ({
  TodosHeader: ({
    disabled,
    onCreate,
  }: {
    disabled: boolean
    onCreate: () => void
  }) => (
    <button disabled={disabled} onClick={onCreate}>
      New task
    </button>
  ),
}))
vi.mock('./components/TodoFilters', () => ({ TodoFilters: () => null }))
vi.mock('./components/TodoList', () => ({
  TodoList: (props: {
    todos: Todo[]
    onCreate: () => void
    onToggle: (todo: Todo) => void
    onEdit: (todo: Todo) => void
    onDelete: (todo: Todo) => void
  }) => (
    <section aria-label="Task list">
      <button onClick={props.onCreate}>Create from list</button>
      {props.todos.map((todo) => (
        <div key={todo.id}>
          <button onClick={() => props.onToggle(todo)}>Toggle {todo.id}</button>
          <button onClick={() => props.onEdit(todo)}>Edit {todo.id}</button>
          <button onClick={() => props.onDelete(todo)}>Delete {todo.id}</button>
        </div>
      ))}
    </section>
  ),
}))
vi.mock('./components/TodoEditor', () => ({
  TodoEditor: (props: {
    todo: Todo | 'new'
    onClose: () => void
    onSaved: (message: string) => void
  }) => (
    <div role="dialog" aria-label="Editor">
      Editing {props.todo === 'new' ? 'new' : props.todo.id}
      <button onClick={props.onClose}>Close editor</button>
      <button onClick={() => props.onSaved('Changes saved.')}>Save</button>
    </div>
  ),
}))
vi.mock('./components/DeleteTodoDialog', () => ({
  DeleteTodoDialog: (props: {
    todo: Todo
    onClose: () => void
    onDeleted: () => void
  }) => (
    <div role="dialog" aria-label="Delete">
      Deleting {props.todo.id}
      <button onClick={props.onClose}>Close delete</button>
      <button onClick={props.onDeleted}>Confirm delete</button>
    </div>
  ),
}))
vi.mock('../../components/SuccessNotice', () => ({ SuccessNotice: () => null }))

const notify = vi.fn()

function mockPage({
  busy = false,
  mutateAsync = vi.fn(),
  mutationError = null as Error | null,
  isPending = false,
} = {}) {
  vi.mocked(useTodosQuery).mockReturnValue({
    data: [todoFixture],
    isPending,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useTodosQuery>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    error: mutationError,
    reset: vi.fn(),
    mutateAsync,
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  vi.mocked(useTodosBusy).mockReturnValue(busy)
  vi.mocked(useNotice).mockReturnValue({ message: '', notify })
  vi.mocked(useTodoFilters).mockReturnValue({
    filter: 'all',
    search: '',
    sort: 'newest',
    visible: [todoFixture],
    setFilter: vi.fn(),
    setSearch: vi.fn(),
    setSort: vi.fn(),
  })
  return { mutateAsync }
}

beforeEach(() => vi.clearAllMocks())

it('displays a query failure and resets mutation errors before retrying', async () => {
  const user = userEvent.setup()
  const refetch = vi.fn().mockResolvedValue(undefined)
  const reset = vi.fn()
  vi.mocked(useTodosQuery).mockReturnValue({
    data: [],
    isPending: false,
    isFetching: false,
    isError: true,
    error: new Error('The server is unavailable.'),
    refetch,
  } as unknown as ReturnType<typeof useTodosQuery>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    error: null,
    reset,
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  vi.mocked(useTodosBusy).mockReturnValue(false)
  vi.mocked(useNotice).mockReturnValue({ message: '', notify: vi.fn() })
  vi.mocked(useTodoFilters).mockReturnValue({
    filter: 'all',
    search: '',
    sort: 'newest',
    visible: [],
    setFilter: vi.fn(),
    setSearch: vi.fn(),
    setSort: vi.fn(),
  })
  render(<TodosPage />)
  expect(screen.getByTestId('alert')).toHaveTextContent(
    'The server is unavailable.',
  )
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1))
  expect(reset).toHaveBeenCalledTimes(1)
  expect(reset.mock.invocationCallOrder[0]).toBeLessThan(
    refetch.mock.invocationCallOrder[0],
  )
})

it.each([
  [true, 'Another task complete. Well done!'],
  [false, 'Task marked as active.'],
])(
  'toggles a task and announces completed=%s',
  async (completed, message) => {
    const user = userEvent.setup()
    const { mutateAsync } = mockPage({
      mutateAsync: vi.fn().mockResolvedValue({ ...todoFixture, completed }),
    })
    render(<TodosPage />)
    await user.click(screen.getByRole('button', { name: 'Toggle 7' }))
    expect(mutateAsync).toHaveBeenCalledWith({
      id: 7,
      input: { completed: true },
    })
    await waitFor(() => expect(notify).toHaveBeenCalledWith(message))
  },
)

it('does not announce a failed toggle and shows the mutation error', async () => {
  const user = userEvent.setup()
  const { mutateAsync } = mockPage({
    mutateAsync: vi.fn().mockRejectedValue(new Error('Toggle failed')),
    mutationError: new Error('Toggle failed'),
  })
  render(<TodosPage />)
  expect(screen.getByTestId('alert')).toHaveTextContent('Toggle failed')
  await user.click(screen.getByRole('button', { name: 'Toggle 7' }))
  await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
  expect(notify).not.toHaveBeenCalled()
})

it('ignores toggles while another mutation is running', async () => {
  const user = userEvent.setup()
  const { mutateAsync } = mockPage({ busy: true })
  render(<TodosPage />)
  expect(screen.getByRole('button', { name: 'New task' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Toggle 7' }))
  expect(mutateAsync).not.toHaveBeenCalled()
})

it('disables creating while the list is loading', () => {
  mockPage({ isPending: true })
  render(<TodosPage />)
  expect(screen.getByRole('button', { name: 'New task' })).toBeDisabled()
})

it('opens the editor for a new task and closes it', async () => {
  const user = userEvent.setup()
  mockPage()
  render(<TodosPage />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'New task' }))
  expect(screen.getByRole('dialog', { name: 'Editor' })).toHaveTextContent(
    'Editing new',
  )
  await user.click(screen.getByRole('button', { name: 'Close editor' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('opens the editor from the empty list too', async () => {
  const user = userEvent.setup()
  mockPage()
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Create from list' }))
  expect(screen.getByRole('dialog', { name: 'Editor' })).toHaveTextContent(
    'Editing new',
  )
})

it('edits a task, closes the editor and announces the save', async () => {
  const user = userEvent.setup()
  mockPage()
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Edit 7' }))
  expect(screen.getByRole('dialog', { name: 'Editor' })).toHaveTextContent(
    'Editing 7',
  )
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(notify).toHaveBeenCalledWith('Changes saved.')
})

it('confirms deletion, closes the dialog and announces it', async () => {
  const user = userEvent.setup()
  mockPage()
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Delete 7' }))
  expect(screen.getByRole('dialog', { name: 'Delete' })).toHaveTextContent(
    'Deleting 7',
  )
  await user.click(screen.getByRole('button', { name: 'Confirm delete' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(notify).toHaveBeenCalledWith('Task deleted.')
})

it('closes the delete dialog without announcing anything', async () => {
  const user = userEvent.setup()
  mockPage()
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Delete 7' }))
  await user.click(screen.getByRole('button', { name: 'Close delete' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(notify).not.toHaveBeenCalled()
})
