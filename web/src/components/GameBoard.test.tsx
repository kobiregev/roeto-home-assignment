import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ALICE_ID, BOB_ID, makeGame } from '../test/fixtures'
import { GameBoard } from './GameBoard'

const handlers = () => ({ onRoll: vi.fn(), onHold: vi.fn(), onLeave: vi.fn() })

describe('GameBoard', () => {
   it('shows the state the server sent: scores, round score, dice and target', () => {
      render(<GameBoard game={makeGame()} me={ALICE_ID} busy={false} {...handlers()} />)

      expect(screen.getByText('alice')).toBeInTheDocument()
      expect(screen.getByText('bob')).toBeInTheDocument()
      expect(screen.getByText('40')).toBeInTheDocument()
      expect(screen.getByText('25')).toBeInTheDocument()
      expect(screen.getByText('7')).toBeInTheDocument() // round score
      expect(screen.getByLabelText('Dice: 3 and 4')).toBeInTheDocument()
      expect(screen.getByText('First to 100')).toBeInTheDocument()
      expect(screen.getByText('(you)')).toBeInTheDocument()
   })

   it('lets the current player roll and hold', async () => {
      const user = userEvent.setup()
      const h = handlers()
      render(<GameBoard game={makeGame()} me={ALICE_ID} busy={false} {...h} />)

      expect(screen.getByText('Your turn')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Roll' }))
      await user.click(screen.getByRole('button', { name: 'Hold' }))

      expect(h.onRoll).toHaveBeenCalledTimes(1)
      expect(h.onHold).toHaveBeenCalledTimes(1)
   })

   it('disables Roll and Hold when it is the other players turn', () => {
      // Same game, viewed from bob's window: it is alice's turn.
      render(<GameBoard game={makeGame()} me={BOB_ID} busy={false} {...handlers()} />)

      expect(screen.getByText('Waiting for alice…')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Roll' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Hold' })).toBeDisabled()
   })

   it('follows the server when the turn changes', () => {
      const { rerender } = render(<GameBoard game={makeGame()} me={BOB_ID} busy={false} {...handlers()} />)
      expect(screen.getByRole('button', { name: 'Roll' })).toBeDisabled()

      rerender(<GameBoard game={makeGame({ currentPlayerId: BOB_ID })} me={BOB_ID} busy={false} {...handlers()} />)

      expect(screen.getByRole('button', { name: 'Roll' })).toBeEnabled()
      expect(screen.getByText('Your turn')).toBeInTheDocument()
   })

   it('disables all buttons while a request is in flight', () => {
      render(<GameBoard game={makeGame()} me={ALICE_ID} busy {...handlers()} />)

      expect(screen.getByRole('button', { name: 'Roll' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Hold' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Leave game' })).toBeDisabled()
   })

   it('lets either player leave, even when it is not their turn', async () => {
      const user = userEvent.setup()
      const h = handlers()
      render(<GameBoard game={makeGame()} me={BOB_ID} busy={false} {...h} />)

      await user.click(screen.getByRole('button', { name: 'Leave game' }))

      expect(h.onLeave).toHaveBeenCalledTimes(1)
   })

   it('shows a placeholder before the first roll', () => {
      render(<GameBoard game={makeGame({ lastRoll: null, roundScore: 0 })} me={ALICE_ID} busy={false} {...handlers()} />)
      expect(screen.getByText('No roll yet')).toBeInTheDocument()
   })
})
