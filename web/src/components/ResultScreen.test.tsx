import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ALICE_ID, BOB_ID, makeGame } from '../test/fixtures'
import { ResultScreen } from './ResultScreen'

const finished = makeGame({ status: 'finished', winnerId: ALICE_ID, currentPlayerId: null, roundScore: 0 })

describe('ResultScreen', () => {
   it('tells the winner they won', () => {
      render(<ResultScreen game={finished} me={ALICE_ID} onBack={vi.fn()} />)
      expect(screen.getByRole('heading', { name: /you won/i })).toBeInTheDocument()
   })

   it('tells the loser who won', () => {
      render(<ResultScreen game={finished} me={BOB_ID} onBack={vi.fn()} />)
      expect(screen.getByRole('heading', { name: 'alice won' })).toBeInTheDocument()
   })

   it('shows the final scores and the target', () => {
      render(<ResultScreen game={finished} me={BOB_ID} onBack={vi.fn()} />)
      expect(screen.getByText(/alice 40 – bob 25/)).toBeInTheDocument()
      expect(screen.getByText(/first to 100/)).toBeInTheDocument()
   })

   it('explains an abandoned game, which has no winner', () => {
      const abandoned = makeGame({ status: 'abandoned', winnerId: null, currentPlayerId: null })
      render(<ResultScreen game={abandoned} me={BOB_ID} onBack={vi.fn()} />)
      expect(screen.getByRole('heading', { name: /ended early/i })).toBeInTheDocument()
   })

   it('goes back to the lobby', async () => {
      const user = userEvent.setup()
      const onBack = vi.fn()
      render(<ResultScreen game={finished} me={ALICE_ID} onBack={onBack} />)

      await user.click(screen.getByRole('button', { name: 'Back to lobby' }))

      expect(onBack).toHaveBeenCalledTimes(1)
   })
})
