import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiClient, errorMessage } from '../api/client'
import type { Game, Session, User } from '../api/types'

const readSession = (key: string): Session | null => {
   try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as Session) : null
   } catch {
      return null
   }
}

const writeSession = (key: string, session: Session | null): void => {
   try {
      if (session) localStorage.setItem(key, JSON.stringify(session))
      else localStorage.removeItem(key)
   } catch {
      // Storage can be unavailable (private mode); the window just will not survive a reload.
   }
}

/**
 * Everything one player window needs: its own login, the game it is looking at, the lobby and the
 * win counts, plus an action per button. The server owns all game state and all rules; this hook
 * only fetches it and forwards clicks.
 *
 * Refreshing: the hook reloads whenever `refreshTick` changes. After every action it calls
 * `onChanged`, and the page bumps the tick, so both windows reload. There is no polling.
 */
export function useWindowSession(storageKey: string, refreshTick: number, onChanged: () => void) {
   const [session, setSession] = useState<Session | null>(() => readSession(storageKey))
   const [game, setGame] = useState<Game | null>(null)
   const [openGames, setOpenGames] = useState<Game[]>([])
   const [users, setUsers] = useState<User[]>([])
   const [dismissedGameId, setDismissedGameId] = useState<string | null>(null)
   const [busy, setBusy] = useState(false)
   const [error, setError] = useState<string | null>(null)

   const logout = useCallback(() => {
      writeSession(storageKey, null)
      setSession(null)
      setGame(null)
      setOpenGames([])
      setUsers([])
      setDismissedGameId(null)
      setError(null)
   }, [storageKey])

   const token = session?.token
   const api = useMemo(() => (token ? new ApiClient(token, logout) : null), [token, logout])

   useEffect(() => {
      if (!api) return

      // `cancelled` drops the answer of an outdated load, so a slow response cannot overwrite a newer one.
      let cancelled = false
      Promise.all([api.currentGame(), api.openGames(), api.listUsers()]).then(
         ([currentGame, open, allUsers]) => {
            if (cancelled) return
            setGame(currentGame)
            setOpenGames(open)
            setUsers(allUsers)
         },
         (err) => {
            if (!cancelled) setError(errorMessage(err))
         }
      )
      return () => {
         cancelled = true
      }
   }, [api, refreshTick])

   /** Runs one user action: busy flag, server error message, then reload everything. */
   const run = async (action: (api: ApiClient) => Promise<unknown>) => {
      if (!api) return
      setBusy(true)
      setError(null)
      try {
         await action(api)
      } catch (err) {
         setError(errorMessage(err))
      } finally {
         setBusy(false)
         onChanged()
      }
   }

   const login = async (username: string, password: string) => {
      setBusy(true)
      setError(null)
      try {
         const newSession = await new ApiClient().login(username, password)
         writeSession(storageKey, newSession)
         setSession(newSession)
      } catch (err) {
         setError(errorMessage(err))
      } finally {
         setBusy(false)
      }
   }

   // A finished or abandoned game stays "current" on the server, so "Back to lobby" is a local choice.
   const visibleGame = game && game.id === dismissedGameId ? null : game

   return {
      session,
      game: visibleGame,
      openGames,
      users,
      busy,
      error,
      login,
      logout,
      createGame: (winningScore?: number) => run((a) => a.createGame(winningScore)),
      joinGame: (id: string) => run((a) => a.joinGame(id)),
      roll: () => visibleGame && run((a) => a.roll(visibleGame.id)),
      hold: () => visibleGame && run((a) => a.hold(visibleGame.id)),
      leaveGame: () => visibleGame && run((a) => a.leaveGame(visibleGame.id)),
      dismissResult: () => setDismissedGameId(visibleGame?.id ?? null),
   }
}

export type WindowSession = ReturnType<typeof useWindowSession>
