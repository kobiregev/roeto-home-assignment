import { conflict, forbidden } from './errors'
import { GameEvent, GameStatus, type DiceRoller, type Game, type Player } from './types'

// Pure game rules: no I/O, no clock, no randomness of its own. Every function returns a new
// state and throws an AppError when the action is not allowed.

type Identity = Pick<Player, 'userId' | 'username'>

export interface ActionResult {
   game: Game
   event: GameEvent
}

export function createGame(id: string, host: Identity, winningScore: number): Game {
   return {
      id,
      players: [{ userId: host.userId, username: host.username, score: 0 }],
      currentPlayerId: null,
      roundScore: 0,
      lastRoll: null,
      winningScore,
      status: GameStatus.Waiting,
      winnerId: null,
   }
}

/** The second player joining is the "ready" signal that starts the game. */
export function joinGame(game: Game, user: Identity): Game {
   if (game.status !== GameStatus.Waiting) throw conflict('Game is not open for joining')
   if (game.players.some((p) => p.userId === user.userId)) throw conflict('You cannot join your own game')

   return {
      ...game,
      players: [...game.players, { userId: user.userId, username: user.username, score: 0 }],
      currentPlayerId: game.players[0].userId,
      status: GameStatus.Active,
   }
}

export function roll(game: Game, userId: string, rollDice: DiceRoller): ActionResult {
   assertCanAct(game, userId)

   const dice = rollDice()
   if (dice[0] === 6 && dice[1] === 6) {
      // Double six: the round score is lost and the turn passes.
      return { game: { ...passTurn(game), lastRoll: dice }, event: GameEvent.Bust }
   }

   return { game: { ...game, roundScore: game.roundScore + dice[0] + dice[1], lastRoll: dice }, event: GameEvent.Rolled }
}

export function hold(game: Game, userId: string): ActionResult {
   assertCanAct(game, userId)
   if (game.roundScore === 0) throw conflict('Nothing to hold: roll first')

   const players = game.players.map((p) => (p.userId === userId ? { ...p, score: p.score + game.roundScore } : p))
   const banked = { ...game, players }

   if (players.find((p) => p.userId === userId)!.score >= game.winningScore) {
      return {
         game: { ...banked, roundScore: 0, lastRoll: null, currentPlayerId: null, status: GameStatus.Finished, winnerId: userId },
         event: GameEvent.Won,
      }
   }
   return { game: passTurn(banked), event: GameEvent.Held }
}

/** Either participant can cancel a waiting game or quit an active one. Nobody wins. */
export function leaveGame(game: Game, userId: string): Game {
   if (!game.players.some((p) => p.userId === userId)) throw forbidden('You are not in this game')
   if (game.status !== GameStatus.Waiting && game.status !== GameStatus.Active) throw conflict('Game is already over')

   return { ...game, status: GameStatus.Abandoned, currentPlayerId: null, roundScore: 0, lastRoll: null }
}

function assertCanAct(game: Game, userId: string): void {
   if (game.status !== GameStatus.Active) throw conflict(`Game is ${game.status}, not active`)
   if (!game.players.some((p) => p.userId === userId)) throw forbidden('You are not in this game')
   if (game.currentPlayerId !== userId) throw forbidden('It is not your turn')
}

/** Ends the current turn: clears the round score and hands over to the other player. */
function passTurn(game: Game): Game {
   const next = game.players.find((p) => p.userId !== game.currentPlayerId)!
   return { ...game, roundScore: 0, lastRoll: null, currentPlayerId: next.userId }
}
