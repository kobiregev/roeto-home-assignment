import type { Game } from '../api/types'
import { Button } from './Button'
import { Dice } from './Dice'

interface Props {
   game: Game
   /** The id of the user this window is logged in as. */
   me: string
   busy: boolean
   onRoll: () => void
   onHold: () => void
   onLeave: () => void
}

/** Renders the state the server sent. The server decides every rule; this only shows it. */
export function GameBoard({ game, me, busy, onRoll, onHold, onLeave }: Props) {
   const isMyTurn = game.currentPlayerId === me
   const currentPlayer = game.players.find((p) => p.userId === game.currentPlayerId)

   return (
      <div className="space-y-5">
         <p className="text-center text-sm text-slate-500">First to {game.winningScore}</p>

         <div className="grid grid-cols-2 gap-3">
            {game.players.map((player) => {
               const isCurrent = player.userId === game.currentPlayerId
               return (
                  <div
                     key={player.userId}
                     className={`rounded-xl border-2 p-3 text-center ${
                        isCurrent ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'
                     }`}
                  >
                     <p className="text-sm font-medium">
                        {player.username}
                        {player.userId === me && <span className="text-slate-400"> (you)</span>}
                     </p>
                     <p className="text-4xl font-bold">{player.score}</p>
                     {isCurrent && <p className="text-xs font-semibold uppercase text-indigo-600">Playing</p>}
                  </div>
               )
            })}
         </div>

         <div className="rounded-xl bg-slate-50 p-4 text-center">
            <Dice roll={game.lastRoll} />
            <p className="mt-2 text-sm text-slate-500">Round score</p>
            <p className="text-3xl font-bold">{game.roundScore}</p>
         </div>

         <p className="text-center font-medium">
            {isMyTurn ? 'Your turn' : `Waiting for ${currentPlayer?.username ?? 'the other player'}…`}
         </p>

         <div className="flex justify-center gap-3">
            <Button onClick={onRoll} disabled={!isMyTurn || busy}>
               Roll
            </Button>
            <Button variant="secondary" onClick={onHold} disabled={!isMyTurn || busy}>
               Hold
            </Button>
         </div>

         <div className="text-center">
            <Button variant="danger" onClick={onLeave} disabled={busy}>
               Leave game
            </Button>
         </div>
      </div>
   )
}
