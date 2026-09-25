export const DEFAULT_WINNING_SCORE = 100
export const MIN_WINNING_SCORE = 10
export const MAX_WINNING_SCORE = 1000

export enum GameStatus {
   Waiting = 'waiting',
   Active = 'active',
   Finished = 'finished',
   Abandoned = 'abandoned',
}

export interface Player {
   userId: string
   username: string
   score: number
}

export interface Game {
   id: string
   players: Player[] // 1 while waiting, 2 once active
   currentPlayerId: string | null // whose turn; null unless active
   roundScore: number // current player's unbanked points; reset on hold/bust
   lastRoll: [number, number] | null // last dice shown; cleared on hold
   winningScore: number
   status: GameStatus
   winnerId: string | null
}

export enum GameEvent {
   Rolled = 'rolled',
   Bust = 'bust',
   Held = 'held',
   Won = 'won',
}

/** Rolls two dice. Injected into the engine so the rules can be tested deterministically. */
export type DiceRoller = () => [number, number]
