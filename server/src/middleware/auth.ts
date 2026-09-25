import type { Request, RequestHandler } from 'express'
import { unauthorized } from '../game/errors'
import type { AuthService, PublicUser } from '../services/authService'

declare global {
   // eslint-disable-next-line @typescript-eslint/no-namespace
   namespace Express {
      interface Request {
         user?: PublicUser
      }
   }
}

/** Requires `Authorization: Bearer <jwt>` and puts the authenticated user on `req.user`. */
export const requireAuth =
   (auth: AuthService): RequestHandler =>
   async (req, _res, next) => {
      const header = req.headers.authorization
      const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined
      if (!token) throw unauthorized('Missing bearer token')

      req.user = await auth.authenticate(token)
      next()
   }

/** The id of the authenticated user. Only valid on routes behind requireAuth. */
export const currentUserId = (req: Request): string => req.user!.id
