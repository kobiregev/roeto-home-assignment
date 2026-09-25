import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeGame } from '../test/fixtures'
import { WaitingRoom } from './WaitingRoom'

const waitingGame = makeGame({ status: 'waiting', players: [{ userId: 'a', username: 'alice', score: 0 }] })

describe('WaitingRoom', () => {
   it('tells the player the game starts when someone joins, and shows the target', () => {
      render(<WaitingRoom game={waitingGame} busy={false} onCancel={vi.fn()} />)

      expect(screen.getByRole('heading', { name: /waiting for an opponent/i })).toBeInTheDocument()
      expect(screen.getByText(/first to 100/i)).toBeInTheDocument()
   })

   it('cancels the game', async () => {
      const user = userEvent.setup()
      const onCancel = vi.fn()
      render(<WaitingRoom game={waitingGame} busy={false} onCancel={onCancel} />)

      await user.click(screen.getByRole('button', { name: 'Cancel game' }))

      expect(onCancel).toHaveBeenCalledTimes(1)
   })

   it('disables Cancel while a request is in flight', () => {
      render(<WaitingRoom game={waitingGame} busy onCancel={vi.fn()} />)
      expect(screen.getByRole('button', { name: 'Cancel game' })).toBeDisabled()
   })
})
