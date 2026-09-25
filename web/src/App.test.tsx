import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
   beforeEach(() => localStorage.clear())

   it('shows two independent player windows, both asking for a login', () => {
      render(<App />)
      expect(screen.getByRole('heading', { name: 'Dice Game' })).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Window 1' })).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Window 2' })).toBeInTheDocument()
      expect(screen.getAllByRole('heading', { name: 'Log in' })).toHaveLength(2)
   })
})
