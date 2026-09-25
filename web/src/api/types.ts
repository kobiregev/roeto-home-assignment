// Mirrors the API's JSON shapes (server/src/game/types.ts and services/authService.ts).
// Duplicated on purpose to keep the two projects independent; a shared package would be the next step.

export type GameStatus = 'waiting' | 'active' | 'finished' | 'abandoned'
export type GameEvent = 'rolled' | 'bust' | 'held' | 'won'

export interface Player {
   userId: string
   username: string
   score: number
}

export interface Game {
   id: string
   players: Player[]
   currentPlayerId: string | null
   roundScore: number
   lastRoll: [number, number] | null
   winningScore: number
   status: GameStatus
   winnerId: string | null
   acknowledgedBy: string[]
}

export interface User {
   id: string
   username: string
   wins: number
}

export interface Session {
   token: string
   user: User
}

export interface ActionResult {
   game: Game
   event: GameEvent
}
