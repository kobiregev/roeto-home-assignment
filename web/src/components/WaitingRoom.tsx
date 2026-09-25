import type { Game } from '../api/types'
import { Button } from './Button'

interface Props {
   game: Game
   busy: boolean
   onCancel: () => void
}

export function WaitingRoom({ game, busy, onCancel }: Props) {
   return (
      <div className="space-y-4 text-center">
         <h2 className="text-lg font-semibold">Waiting for an opponent…</h2>
         <p className="text-sm text-slate-600">
            First to {game.winningScore}. The game starts when another player joins it from their window.
         </p>
         <Button variant="danger" onClick={onCancel} disabled={busy}>
            Cancel game
         </Button>
      </div>
   )
}
