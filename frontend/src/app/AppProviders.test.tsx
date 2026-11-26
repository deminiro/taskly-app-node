import { QueryClient, useQueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useTheme } from 'styled-components'
import { AppProviders } from './AppProviders'

function Probe() {
  const client = useQueryClient()
  const theme = useTheme()
  return <p data-testid="p">{String(client.getDefaultOptions() !== undefined)}-{typeof theme}</p>
}

it('provides query client and theme to children', () => {
  render(<AppProviders client={new QueryClient()}><Probe /></AppProviders>)
  expect(screen.getByTestId('p')).toHaveTextContent('true-object')
})
it('falls back to the shared client', () => {
  render(<AppProviders><span>child</span></AppProviders>)
  expect(screen.getByText('child')).toBeVisible()
})
