import { render, screen } from '@testing-library/react'
import { useWindowSession, type WindowSession } from '../hooks/useWindowSession'
import { ALICE_ID, makeGame } from '../test/fixtures'
import { PlayerWindow } from './PlayerWindow'

// Only the screen selection is under test here; the hook has its own tests.
vi.mock('../hooks/useWindowSession')

const loggedIn = { token: 't', user: { id: ALICE_ID, username: 'alice', wins: 2 } }

const show = (state: Partial<WindowSession>) => {
   vi.mocked(useWindowSession).mockReturnValue({
      session: null,
      game: null,
      openGames: [],
      users: [],
      busy: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      createGame: vi.fn(),
      joinGame: vi.fn(),
      roll: vi.fn(),
      hold: vi.fn(),
      leaveGame: vi.fn(),
      dismissResult: vi.fn(),
      ...state,
   } as WindowSession)
   render(<PlayerWindow title="Window 1" storageKey="k" refreshTick={0} onChanged={vi.fn()} />)
}

describe('PlayerWindow screen selection', () => {
   it('asks for a login when there is no session', () => {
      show({})
      expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument()
      expect(screen.queryByText('Wins')).not.toBeInTheDocument()
   })

   it('shows the lobby when logged in without a game, with the user and the wins', () => {
      show({ session: loggedIn, users: [{ id: ALICE_ID, username: 'alice', wins: 2 }] })
      expect(screen.getByText('Start a new game')).toBeInTheDocument()
      expect(screen.getByText('Playing as')).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Wins' })).toHaveTextContent('alice 2')
   })

   it('shows the waiting room for a waiting game', () => {
      show({ session: loggedIn, game: makeGame({ status: 'waiting', currentPlayerId: null }) })
      expect(screen.getByRole('heading', { name: /waiting for an opponent/i })).toBeInTheDocument()
   })

   it('shows the board for an active game', () => {
      show({ session: loggedIn, game: makeGame() })
      expect(screen.getByRole('button', { name: 'Roll' })).toBeInTheDocument()
   })

   it.each(['finished', 'abandoned'] as const)('shows the result screen for a %s game', (status) => {
      show({ session: loggedIn, game: makeGame({ status, currentPlayerId: null }) })
      expect(screen.getByRole('button', { name: 'Back to lobby' })).toBeInTheDocument()
   })

   it('shows the server error message', () => {
      show({ error: 'It is not your turn' })
      expect(screen.getByRole('alert')).toHaveTextContent('It is not your turn')
   })
})
