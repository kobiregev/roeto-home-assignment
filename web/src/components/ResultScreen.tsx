import type { Game } from '../api/types'
import { Button } from './Button'

interface Props {
   game: Game
   /** The id of the user this window is logged in as. */
   me: string
   onBack: () => void
}

/** Shown for a game that has ended: either someone won, or a player left. */
export function ResultScreen({ game, me, onBack }: Props) {
   const winner = game.players.find((p) => p.userId === game.winnerId)

   return (
      <div className="space-y-4 text-center">
         {winner ? (
            <h2 className="text-2xl font-bold">{winner.userId === me ? 'You won! 🎉' : `${winner.username} won`}</h2>
         ) : (
            <h2 className="text-lg font-semibold">The game ended early because a player left.</h2>
         )}

         <p className="text-sm text-slate-600">
            {game.players.map((p) => `${p.username} ${p.score}`).join(' – ')} (first to {game.winningScore})
         </p>

         <Button onClick={onBack}>Back to lobby</Button>
      </div>
   )
}
