/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PinnedCarStory from './PinnedCarStory'

vi.mock('./usePinnedCarStory', () => ({
  usePinnedCarStory: () => ({ storyRef: { current: null } }),
}))

afterEach(cleanup)

function renderStory() {
  return render(
    <MemoryRouter>
      <PinnedCarStory />
    </MemoryRouter>,
  )
}

describe('PinnedCarStory', () => {
  it('renders every service state as real editorial content', () => {
    renderStory()

    expect(screen.getByText('From daily dirt to showroom finish.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Carwash' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Detailing' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Paint protection film' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ceramic coating' })).toBeInTheDocument()
  })

  it('updates the package preview on focus and click', () => {
    renderStory()
    const preview = screen.getByTestId('package-preview')
    const ppfButton = screen.getByRole('button', { name: 'Preview PPF package' })

    expect(preview).toHaveAttribute('data-state', 'washed')
    fireEvent.focus(ppfButton)
    expect(preview).toHaveAttribute('data-state', 'ppf')

    fireEvent.click(screen.getByRole('button', { name: 'Preview Ceramic package' }))
    expect(preview).toHaveAttribute('data-state', 'ceramic')
  })

  it('keeps booking and package routes actionable', () => {
    renderStory()

    expect(screen.getByRole('link', { name: 'View all packages' })).toHaveAttribute('href', '/packages')
    expect(screen.getByRole('link', { name: 'Book a service' })).toHaveAttribute('href', '/book')
  })
})
