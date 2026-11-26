import { QueryClient, useQueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { AppProviders } from './AppProviders'

it('renders children with the given query client', () => {
  const client = new QueryClient()
  let received: QueryClient | undefined
  function Probe() {
    received = useQueryClient()
    return <p>Child content</p>
  }
  render(
    <AppProviders client={client}>
      <Probe />
    </AppProviders>,
  )
  expect(screen.getByText('Child content')).toBeVisible()
  expect(received).toBe(client)
})

it('falls back to the shared query client', () => {
  render(
    <AppProviders>
      <p>Default client</p>
    </AppProviders>,
  )
  expect(screen.getByText('Default client')).toBeVisible()
})
