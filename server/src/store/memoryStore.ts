import { randomUUID } from 'node:crypto'
import { GameStatus, type Game } from '../game/types'
import type { Store, User } from './store'

// Games are stored by reference. That is safe because the engine never mutates a game,
// it always returns a new one, so a stored game can only change through saveGame.
export class MemoryStore implements Store {
   private users = new Map<string, User>()
   private games = new Map<string, Game>()

   async createUser(input: { username: string; passwordHash: string }): Promise<User> {
      if (await this.findUserByUsername(input.username)) throw new Error(`Username taken: ${input.username}`)
      const user: User = { id: randomUUID(), username: input.username, passwordHash: input.passwordHash, wins: 0 }
      this.users.set(user.id, user)
      return user
   }

   async findUserById(id: string): Promise<User | undefined> {
      return this.users.get(id)
   }

   async findUserByUsername(username: string): Promise<User | undefined> {
      return [...this.users.values()].find((u) => u.username === username)
   }

   async listUsers(): Promise<User[]> {
      return [...this.users.values()]
   }

   async incrementWins(userId: string): Promise<void> {
      const user = this.users.get(userId)
      if (user) user.wins += 1
   }

   async saveGame(game: Game): Promise<void> {
      this.games.set(game.id, game)
   }

   async getGame(id: string): Promise<Game | undefined> {
      return this.games.get(id)
   }

   async listWaitingGames(): Promise<Game[]> {
      return [...this.games.values()].filter((g) => g.status === GameStatus.Waiting)
   }

   async findLatestGameFor(userId: string): Promise<Game | undefined> {
      // A Map iterates in creation order and keeps a game's position when it is saved again.
      return [...this.games.values()].reverse().find((g) => g.players.some((p) => p.userId === userId))
   }

   async listUnfinishedGamesFor(userId: string): Promise<Game[]> {
      return [...this.games.values()].filter(
         (g) =>
            (g.status === GameStatus.Waiting || g.status === GameStatus.Active) &&
            g.players.some((p) => p.userId === userId)
      )
   }
}
