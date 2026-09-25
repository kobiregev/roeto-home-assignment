import cors from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import { AppError } from './game/errors'
import type { DiceRoller } from './game/types'
import { requireAuth } from './middleware/auth'
import { authRoutes } from './routes/auth'
import { gameRoutes } from './routes/games'
import { userRoutes } from './routes/users'
import { AuthService } from './services/authService'
import { GameService } from './services/gameService'
import type { Store } from './store/store'

export interface AppDeps {
   store: Store
   jwtSecret: string
   rollDice?: DiceRoller // tests inject fixed dice
}

export function createApp({ store, jwtSecret, rollDice }: AppDeps) {
   const auth = new AuthService(store, jwtSecret)
   const games = new GameService(store, rollDice)
   const authenticated = requireAuth(auth)

   const app = express()
   app.use(cors())
   app.use(express.json())

   app.get('/api/health', (_req, res) => {
      res.json({ ok: true })
   })
   app.use('/api/auth', authRoutes(auth))
   app.use('/api/users', authenticated, userRoutes(auth))
   app.use('/api/games', authenticated, gameRoutes(games))

   app.use((_req, res) => {
      res.status(404).json({ error: 'Not found' })
   })

   const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
      if (err instanceof AppError) {
         res.status(err.status).json({ error: err.message })
         return
      }
      if (err?.type === 'entity.parse.failed') {
         res.status(400).json({ error: 'Invalid JSON body' })
         return
      }
      console.error(err)
      res.status(500).json({ error: 'Internal server error' })
   }
   app.use(errorHandler)

   return app
}
