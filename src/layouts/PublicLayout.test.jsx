/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import PublicLayout from './PublicLayout'

afterEach(cleanup)

function renderLayout() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<p>Home content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('PublicLayout', () => {
  it('adds the scrolled treatment only after leaving the top of the page', () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    renderLayout()
    const header = screen.getByRole('banner')

    expect(header).not.toHaveClass('is-scrolled')

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 80 })
    fireEvent.scroll(window)
    expect(header).toHaveClass('is-scrolled')
  })
})
