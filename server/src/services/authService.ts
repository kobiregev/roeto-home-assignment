import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { unauthorized } from '../game/errors'
import type { Store, User } from '../store/store'

/** A user as the API exposes it: never includes the password hash. */
export interface PublicUser {
   id: string
   username: string
   wins: number
}

export const toPublicUser = (user: User): PublicUser => ({ id: user.id, username: user.username, wins: user.wins })

const TOKEN_LIFETIME = '8h'

export class AuthService {
   constructor(
      private readonly store: Store,
      private readonly jwtSecret: string
   ) {}

   async login(username: string, password: string): Promise<{ token: string; user: PublicUser }> {
      const user = await this.store.findUserByUsername(username)
      // Same message for an unknown user and a wrong password, so usernames cannot be probed.
      const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false
      if (!user || !passwordMatches) {
         throw unauthorized('Invalid username or password')
      }
      const token = jwt.sign({ username: user.username }, this.jwtSecret, {
         subject: user.id,
         expiresIn: TOKEN_LIFETIME,
      })
      return { token, user: toPublicUser(user) }
   }

   /** Verifies a token and returns the user it belongs to. */
   async authenticate(token: string): Promise<PublicUser> {
      let userId: string | undefined
      try {
         userId = jwt.verify(token, this.jwtSecret).sub as string | undefined
      } catch {
         throw unauthorized('Invalid or expired token')
      }
      // Looking the user up also rejects tokens that outlive a server restart (in-memory store).
      const user = userId ? await this.store.findUserById(userId) : undefined
      if (!user) throw unauthorized('Invalid or expired token')
      return toPublicUser(user)
   }

   async listPlayers(): Promise<PublicUser[]> {
      const users = await this.store.listUsers()
      const players = users.map(toPublicUser)
      return players
   }
}
