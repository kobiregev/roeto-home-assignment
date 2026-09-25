import { useWindowSession } from '../hooks/useWindowSession'
import { Button } from './Button'
import { ErrorBanner } from './ErrorBanner'
import { GameBoard } from './GameBoard'
import { LoginForm } from './LoginForm'
import { Lobby } from './Lobby'
import { ResultScreen } from './ResultScreen'
import { WaitingRoom } from './WaitingRoom'
import { Wins } from './Wins'

interface Props {
   title: string
   storageKey: string
   refreshTick: number
   onChanged: () => void
}

/** One simulated player: its own login, its own view of the game. */
export function PlayerWindow({ title, storageKey, refreshTick, onChanged }: Props) {
   const s = useWindowSession(storageKey, refreshTick, onChanged)

   return (
      <section aria-label={title} className="rounded-2xl bg-white p-6 shadow">
         <header className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
            {s.session && (
               <div className="flex items-center gap-3 text-sm">
                  <span>
                     Playing as <strong>{s.session.user.username}</strong>
                  </span>
                  <Button variant="secondary" className="!px-3 !py-1" onClick={s.logout}>
                     Log out
                  </Button>
               </div>
            )}
         </header>

         <ErrorBanner message={s.error} />

         {!s.session ? (
            <LoginForm busy={s.busy} onLogin={s.login} />
         ) : !s.game ? (
            <Lobby openGames={s.openGames} busy={s.busy} onCreate={s.createGame} onJoin={s.joinGame} />
         ) : s.game.status === 'waiting' ? (
            <WaitingRoom game={s.game} busy={s.busy} onCancel={s.leaveGame} />
         ) : s.game.status === 'active' ? (
            <GameBoard
               game={s.game}
               me={s.session.user.id}
               busy={s.busy}
               onRoll={s.roll}
               onHold={s.hold}
               onLeave={s.leaveGame}
            />
         ) : (
            <ResultScreen game={s.game} me={s.session.user.id} onBack={s.dismissResult} />
         )}

         {s.session && <Wins users={s.users} />}
      </section>
   )
}
