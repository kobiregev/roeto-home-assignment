import type { Game } from '../game/types'

export interface User {
   id: string
   username: string
   passwordHash: string
   wins: number
}

/**
 * Persistence boundary. Async on purpose, so a file or SQL implementation is a drop-in
 * replacement for the in-memory one without touching the services.
 */
export interface Store {
   createUser(input: { username: string; passwordHash: string }): Promise<User>
   findUserById(id: string): Promise<User | undefined>
   findUserByUsername(username: string): Promise<User | undefined>
   listUsers(): Promise<User[]>
   incrementWins(userId: string): Promise<void>

   saveGame(game: Game): Promise<void>
   getGame(id: string): Promise<Game | undefined>
   /** Games waiting for a second player (the lobby), oldest first. */
   listWaitingGames(): Promise<Game[]>
   /** Games the user is in that are still waiting or active. */
   listUnfinishedGamesFor(userId: string): Promise<Game[]>
}
