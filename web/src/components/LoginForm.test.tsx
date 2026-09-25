import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from './LoginForm'

describe('LoginForm', () => {
   it('submits the typed credentials', async () => {
      const user = userEvent.setup()
      const onLogin = vi.fn()
      render(<LoginForm busy={false} onLogin={onLogin} />)

      await user.type(screen.getByLabelText('Username'), 'alice')
      await user.type(screen.getByLabelText('Password'), 'alice123')
      await user.click(screen.getByRole('button', { name: 'Log in' }))

      expect(onLogin).toHaveBeenCalledWith('alice', 'alice123')
   })

   it('cannot be submitted while a field is empty', async () => {
      const user = userEvent.setup()
      render(<LoginForm busy={false} onLogin={vi.fn()} />)
      const button = screen.getByRole('button', { name: 'Log in' })
      expect(button).toBeDisabled()

      await user.type(screen.getByLabelText('Username'), 'alice')
      expect(button).toBeDisabled()

      await user.type(screen.getByLabelText('Password'), 'x')
      expect(button).toBeEnabled()
   })

   it('is disabled while a request is in flight', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<LoginForm busy={false} onLogin={vi.fn()} />)
      await user.type(screen.getByLabelText('Username'), 'alice')
      await user.type(screen.getByLabelText('Password'), 'x')

      rerender(<LoginForm busy onLogin={vi.fn()} />)

      expect(screen.getByRole('button', { name: 'Log in' })).toBeDisabled()
   })
})
