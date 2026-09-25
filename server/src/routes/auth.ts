import { Router } from 'express'
import { loginSchema, parse } from '../schemas'
import type { AuthService } from '../services/authService'

export function authRoutes(auth: AuthService): Router {
   const router = Router()

   router.post('/login', async (req, res) => {
      const { username, password } = parse(loginSchema, req.body)
      const result = await auth.login(username, password)
      res.json(result)
   })

   return router
}
