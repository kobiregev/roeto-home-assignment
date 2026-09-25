import { act, renderHook, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { ApiClient } from '../api/client'
import type { Game, Session } from '../api/types'
import { useWindowSession } from './useWindowSession'

// Keep the real errorMessage, replace only the network-facing client.
vi.mock('../api/client', async (importOriginal) => ({
   ...(await importOriginal<typeof import('../api/client')>()),
   ApiClient: vi.fn(),
}))

const KEY = 'test.window'
const session: Session = { token: 'token-a', user: { id: 'a', username: 'alice', wins: 0 } }

const makeGame = (overrides: Partial<Game> = {}): Game => ({
   id: 'g1',
   players: [
      { userId: 'a', username: 'alice', score: 0 },
      { userId: 'b', username: 'bob', score: 0 },
   ],
   currentPlayerId: 'a',
   roundScore: 0,
   lastRoll: null,
   winningScore: 100,
   status: 'active',
   winnerId: null,
   ...overrides,
})

const apiError = (status: number, error: string) =>
   new AxiosError('failed', String(status), undefined, undefined, { status, data: { error } } as never)

const api = {
   login: vi.fn(),
   listUsers: vi.fn(),
   openGames: vi.fn(),
   currentGame: vi.fn(),
   createGame: vi.fn(),
   joinGame: vi.fn(),
   leaveGame: vi.fn(),
   roll: vi.fn(),
   hold: vi.fn(),
}

const onChanged = vi.fn()

/** Renders the hook with a saved login, and waits until the first load has finished. */
async function renderLoggedIn(currentGame: Game | null = null) {
   localStorage.setItem(KEY, JSON.stringify(session))
   api.currentGame.mockResolvedValue(currentGame)
   const hook = renderHook(({ tick }) => useWindowSession(KEY, tick, onChanged), { initialProps: { tick: 0 } })
   await waitFor(() => expect(api.currentGame).toHaveBeenCalled())
   await waitFor(() => expect(hook.result.current.users).toHaveLength(1))
   return hook
}

beforeEach(() => {
   localStorage.clear()
   vi.clearAllMocks()
   api.login.mockResolvedValue(session)
   api.listUsers.mockResolvedValue([{ id: 'a', username: 'alice', wins: 0 }])
   api.openGames.mockResolvedValue([])
   api.currentGame.mockResolvedValue(null)
   // `new ApiClient(...)` hands back the fake: a constructor that returns an object yields that object.
   vi.mocked(ApiClient).mockImplementation(function () {
      return api as unknown as ApiClient
   })
})

describe('useWindowSession', () => {
   it('starts logged out without calling the API', () => {
      const { result } = renderHook(() => useWindowSession(KEY, 0, onChanged))
      expect(result.current.session).toBeNull()
      expect(api.currentGame).not.toHaveBeenCalled()
   })

   it('logs in, saves the session and loads game, lobby and wins', async () => {
      const { result } = renderHook(() => useWindowSession(KEY, 0, onChanged))

      await act(() => result.current.login('alice', 'alice123'))

      expect(api.login).toHaveBeenCalledWith('alice', 'alice123')
      expect(result.current.session).toEqual(session)
      expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(session)
      await waitFor(() => expect(result.current.users).toHaveLength(1))
      expect(api.currentGame).toHaveBeenCalled()
      expect(api.openGames).toHaveBeenCalled()
   })

   it('shows the server message and stays logged out when the login is rejected', async () => {
      api.login.mockRejectedValue(apiError(401, 'Invalid username or password'))
      const { result } = renderHook(() => useWindowSession(KEY, 0, onChanged))

      await act(() => result.current.login('alice', 'wrong'))

      expect(result.current.session).toBeNull()
      expect(result.current.error).toBe('Invalid username or password')
      expect(localStorage.getItem(KEY)).toBeNull()
   })

   it('restores a saved session and loads on mount', async () => {
      const { result } = await renderLoggedIn(makeGame())
      expect(result.current.session).toEqual(session)
      await waitFor(() => expect(result.current.game?.id).toBe('g1'))
   })

   it('reloads when the refresh tick changes (this is how the other window updates)', async () => {
      const { rerender } = await renderLoggedIn()
      expect(api.currentGame).toHaveBeenCalledTimes(1)

      rerender({ tick: 1 })

      await waitFor(() => expect(api.currentGame).toHaveBeenCalledTimes(2))
   })

   it('ignores a slow, outdated load that finishes after a newer one', async () => {
      const oldGame = makeGame({ id: 'old' })
      const newGame = makeGame({ id: 'new' })
      let resolveSlow: (game: Game) => void = () => {}
      const slow = new Promise<Game>((resolve) => {
         resolveSlow = resolve
      })
      api.currentGame.mockReturnValueOnce(slow).mockResolvedValue(newGame)

      localStorage.setItem(KEY, JSON.stringify(session))
      const { result, rerender } = renderHook(({ tick }) => useWindowSession(KEY, tick, onChanged), {
         initialProps: { tick: 0 },
      })
      rerender({ tick: 1 }) // starts a second load that answers first
      await waitFor(() => expect(result.current.game?.id).toBe('new'))

      await act(async () => {
         resolveSlow(oldGame) // the first load finally answers with stale data
      })

      expect(result.current.game?.id).toBe('new')
   })

   it('roll calls the API for the current game, then asks the page to refresh', async () => {
      api.roll.mockResolvedValue({ game: makeGame({ roundScore: 7 }), event: 'rolled' })
      const { result } = await renderLoggedIn(makeGame())
      await waitFor(() => expect(result.current.game).not.toBeNull())

      await act(async () => {
         await result.current.roll()
      })

      expect(api.roll).toHaveBeenCalledWith('g1')
      expect(onChanged).toHaveBeenCalledTimes(1)
      expect(result.current.error).toBeNull()
   })

   it('shows the server error when an action is rejected, and still refreshes', async () => {
      api.hold.mockRejectedValue(apiError(403, 'It is not your turn'))
      const { result } = await renderLoggedIn(makeGame())
      await waitFor(() => expect(result.current.game).not.toBeNull())

      await act(async () => {
         await result.current.hold()
      })

      expect(result.current.error).toBe('It is not your turn')
      expect(onChanged).toHaveBeenCalledTimes(1)
      expect(result.current.busy).toBe(false)
   })

   it('creates and joins games through the API', async () => {
      const { result } = await renderLoggedIn()

      await act(async () => {
         await result.current.createGame(50)
         await result.current.joinGame('g9')
      })

      expect(api.createGame).toHaveBeenCalledWith(50)
      expect(api.joinGame).toHaveBeenCalledWith('g9')
   })

   it('hides a finished game after "Back to lobby"', async () => {
      const finished = makeGame({ status: 'finished', winnerId: 'a', currentPlayerId: null })
      const { result } = await renderLoggedIn(finished)
      await waitFor(() => expect(result.current.game).not.toBeNull())

      act(() => result.current.dismissResult())

      expect(result.current.game).toBeNull()
   })

   it('logout clears the session, the stored login and the data', async () => {
      const { result } = await renderLoggedIn(makeGame())
      await waitFor(() => expect(result.current.game).not.toBeNull())

      act(() => result.current.logout())

      expect(result.current.session).toBeNull()
      expect(result.current.game).toBeNull()
      expect(localStorage.getItem(KEY)).toBeNull()
   })
})
