import { useState } from 'react'
import type { Game } from '../api/types'
import { Button } from './Button'

interface Props {
   openGames: Game[]
   busy: boolean
   onCreate: (winningScore?: number) => void
   onJoin: (gameId: string) => void
}

export function Lobby({ openGames, busy, onCreate, onJoin }: Props) {
   const [winningScore, setWinningScore] = useState('100')

   // The server validates the range; an empty field just means "use the default".
   const create = () => onCreate(winningScore.trim() === '' ? undefined : Number(winningScore))

   return (
      <div className="space-y-6">
         <section>
            <h2 className="mb-2 text-lg font-semibold">Start a new game</h2>
            <div className="flex items-end gap-3">
               <label className="text-sm font-medium">
                  Winning score
                  <input
                     className="mt-1 block w-28 rounded-lg border border-slate-300 px-3 py-2"
                     type="number"
                     value={winningScore}
                     onChange={(e) => setWinningScore(e.target.value)}
                  />
               </label>
               <Button onClick={create} disabled={busy}>
                  Create game
               </Button>
            </div>
            <p className="mt-2 text-xs text-slate-500">The game starts when another player joins it.</p>
         </section>

         <section>
            <h2 className="mb-2 text-lg font-semibold">Open games</h2>
            {openGames.length === 0 ? (
               <p className="text-sm text-slate-500">No open games. Create one, or wait for another player to.</p>
            ) : (
               <ul className="space-y-2">
                  {openGames.map((game) => (
                     <li key={game.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                        <span className="text-sm">
                           <strong>{game.players[0].username}</strong> is waiting, first to {game.winningScore}
                        </span>
                        <Button variant="secondary" onClick={() => onJoin(game.id)} disabled={busy}>
                           Join
                        </Button>
                     </li>
                  ))}
               </ul>
            )}
         </section>
      </div>
   )
}
