import axios, { type AxiosInstance } from 'axios'
import type { ActionResult, Game, Session, User } from './types'

/**
 * One API client per player window. The token lives in the instance instead of a global default
 * header, because two windows are two different users on the same page.
 */
export class ApiClient {
   private readonly http: AxiosInstance

   /** `onUnauthorized` fires when the server rejects this client's token, so the window can log out. */
   constructor(token?: string, onUnauthorized?: () => void) {
      this.http = axios.create({
         baseURL: '/api',
         headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      this.http.interceptors.response.use(
         (res) => res,
         (err) => {
            // A 401 from the login form (no token yet) just means wrong credentials.
            if (token && axios.isAxiosError(err) && err.response?.status === 401) onUnauthorized?.()
            return Promise.reject(err)
         }
      )
   }

   async login(username: string, password: string): Promise<Session> {
      const res = await this.http.post<Session>('/auth/login', { username, password })
      return res.data
   }

   async listUsers(): Promise<User[]> {
      const res = await this.http.get<{ users: User[] }>('/users')
      return res.data.users
   }

   async createGame(winningScore?: number): Promise<Game> {
      const res = await this.http.post<{ game: Game }>('/games', { winningScore })
      return res.data.game
   }

   async openGames(): Promise<Game[]> {
      const res = await this.http.get<{ games: Game[] }>('/games/open')
      return res.data.games
   }

   async currentGame(): Promise<Game | null> {
      const res = await this.http.get<{ game: Game | null }>('/games/current')
      return res.data.game
   }

   async joinGame(id: string): Promise<Game> {
      const res = await this.http.post<{ game: Game }>(`/games/${id}/join`)
      return res.data.game
   }

   async leaveGame(id: string): Promise<Game> {
      const res = await this.http.post<{ game: Game }>(`/games/${id}/leave`)
      return res.data.game
   }

   async acknowledgeGame(id: string): Promise<Game> {
      const res = await this.http.post<{ game: Game }>(`/games/${id}/acknowledge`)
      return res.data.game
   }

   async roll(id: string): Promise<ActionResult> {
      const res = await this.http.post<ActionResult>(`/games/${id}/roll`)
      return res.data
   }

   async hold(id: string): Promise<ActionResult> {
      const res = await this.http.post<ActionResult>(`/games/${id}/hold`)
      return res.data
   }
}

/** The server's error message when there is one, otherwise a generic explanation. */
export function errorMessage(err: unknown): string {
   if (axios.isAxiosError(err)) {
      const serverMessage = err.response?.data?.error
      if (typeof serverMessage === 'string') return serverMessage
      if (!err.response) return 'Cannot reach the server. Is the API running?'
   }
   return err instanceof Error ? err.message : 'Something went wrong'
}
