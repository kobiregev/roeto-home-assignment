import { randomUUID } from 'node:crypto'
import { randomDice } from '../game/dice'
import * as engine from '../game/engine'
import { forbidden, notFound } from '../game/errors'
import { DEFAULT_WINNING_SCORE, GameEvent, type DiceRoller, type Game } from '../game/types'
import type { Store, User } from '../store/store'

export interface ActionResult {
   game: Game
   event: GameEvent
}

/**
 * Orchestrates one request: load, let the engine apply the rules, save.
 * All rules live in the engine; this class only decides which games to load and save.
 */
export class GameService {
   // Tail of the pending work per game. See withGameLock.
   private locks = new Map<string, Promise<unknown>>()

   constructor(
      private readonly store: Store,
      private readonly rollDice: DiceRoller = randomDice,
      private readonly newId: () => string = randomUUID
   ) {}

   /** Starts a new game in the lobby. Any unfinished game of the creator is abandoned. */
   async createGame(userId: string, winningScore = DEFAULT_WINNING_SCORE): Promise<Game> {
      const user = await this.requireUser(userId)
      await this.abandonUnfinished(userId)

      const game = engine.createGame(this.newId(), toIdentity(user), winningScore)
      await this.store.saveGame(game)
      return game
   }

   /** Joining is the "ready" signal: the game becomes active once a different user is in. */
   joinGame(userId: string, gameId: string): Promise<Game> {
      return this.withGameLock(gameId, async () => {
         const user = await this.requireUser(userId)
         const game = await this.requireGame(gameId)

         // The engine validates first, so a rejected join never abandons the user's current game.
         const joined = engine.joinGame(game, toIdentity(user))
         await this.abandonUnfinished(userId, gameId)
         await this.store.saveGame(joined)
         return joined
      })
   }

   roll(userId: string, gameId: string): Promise<ActionResult> {
      return this.withGameLock(gameId, async () => {
         const game = await this.requireGame(gameId)
         const result = engine.roll(game, userId, this.rollDice)
         await this.store.saveGame(result.game)
         return result
      })
   }

   hold(userId: string, gameId: string): Promise<ActionResult> {
      return this.withGameLock(gameId, async () => {
         const game = await this.requireGame(gameId)
         const result = engine.hold(game, userId)
         await this.store.saveGame(result.game)
         if (result.event === GameEvent.Won) await this.store.incrementWins(userId)
         return result
      })
   }

   leaveGame(userId: string, gameId: string): Promise<Game> {
      return this.withGameLock(gameId, async () => {
         const game = await this.requireGame(gameId)
         const left = engine.leaveGame(game, userId)
         await this.store.saveGame(left)
         return left
      })
   }

   /** A game is visible to its participants only. */
   async getGame(userId: string, gameId: string): Promise<Game> {
      const game = await this.requireGame(gameId)
      if (!game.players.some((p) => p.userId === userId)) throw forbidden('You are not in this game')
      return game
   }

   /** The lobby: waiting games created by other users. */
   async listOpenGames(userId: string): Promise<Game[]> {
      const waiting = await this.store.listWaitingGames()
      return waiting.filter((g) => !g.players.some((p) => p.userId === userId))
   }

   /** The user's waiting or active game, if any. There is at most one. */
   async getCurrentGame(userId: string): Promise<Game | null> {
      const games = await this.store.listUnfinishedGamesFor(userId)
      return games[0] ?? null
   }

   private async abandonUnfinished(userId: string, exceptGameId?: string): Promise<void> {
      for (const game of await this.store.listUnfinishedGamesFor(userId)) {
         if (game.id !== exceptGameId) await this.store.saveGame(engine.leaveGame(game, userId))
      }
   }

   private async requireGame(gameId: string): Promise<Game> {
      const game = await this.store.getGame(gameId)
      if (!game) throw notFound('Game not found')
      return game
   }

   private async requireUser(userId: string): Promise<User> {
      const user = await this.store.findUserById(userId)
      if (!user) throw notFound('User not found')
      return user
   }

   /**
    * Runs actions on the same game one after another. Each action is load, then save, with
    * awaits in between, so without this two simultaneous requests (a double-clicked Hold)
    * could both read the same state and both apply, e.g. counting a win twice.
    */
   private withGameLock<T>(gameId: string, action: () => Promise<T>): Promise<T> {
      const previous = this.locks.get(gameId) ?? Promise.resolve()
      const run = previous.then(action, action)
      const tail = run.catch(() => undefined)
      this.locks.set(gameId, tail)
      void tail.then(() => {
         if (this.locks.get(gameId) === tail) this.locks.delete(gameId)
      })
      return run
   }
}

const toIdentity = (user: User) => ({ userId: user.id, username: user.username })
