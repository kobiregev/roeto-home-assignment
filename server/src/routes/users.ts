import { Router } from 'express'
import type { AuthService } from '../services/authService'

/** Players and their win counts. Mounted behind requireAuth. */
export function userRoutes(auth: AuthService): Router {
   const router = Router()

   router.get('/', async (_req, res) => {
      const users = await auth.listPlayers()
      res.json({ users })
   })

   return router
}
