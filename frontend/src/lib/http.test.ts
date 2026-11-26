import { afterEach, expect, it, vi } from 'vitest'
import { request } from './http'

afterEach(() => vi.unstubAllGlobals())
const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status })

it('prefixes the path, sends JSON headers and parses the body', async () => {
  const fetchMock = vi.fn().mockResolvedValue(json(200, { a: 1 }))
  vi.stubGlobal('fetch', fetchMock)
  await expect(request('/x', { headers: { 'X-Test': '1' } })).resolves.toEqual({ a: 1 })
  expect(fetchMock).toHaveBeenCalledWith('/api/x', {
    headers: { 'Content-Type': 'application/json', 'X-Test': '1' },
  })
})
it('returns undefined for 204', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
  await expect(request('/x')).resolves.toBeUndefined()
})
it('reports a connection error when fetch fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('net')))
  await expect(request('/x')).rejects.toThrow('Cannot connect to the server. Please try again.')
})
it('rethrows the original error when the request was aborted', async () => {
  const controller = new AbortController()
  controller.abort()
  const abortError = new DOMException('aborted', 'AbortError')
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError))
  await expect(request('/x', { signal: controller.signal })).rejects.toBe(abortError)
})
it('maps 422 to a validation message', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(422, { detail: [] })))
  await expect(request('/x')).rejects.toThrow(/Check the task details/)
})
it('uses a string detail from the server', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(404, { detail: 'Task not found.' })))
  await expect(request('/x')).rejects.toThrow('Task not found.')
})
it('falls back to a generic message for unparseable or non-string detail', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('oops', { status: 500 })).mockResolvedValueOnce(json(500, { detail: 5 })))
  await expect(request('/x')).rejects.toThrow('The operation failed. Please try again.')
  await expect(request('/x')).rejects.toThrow('The operation failed. Please try again.')
})
