import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { seedUsers, SEED_USERS } from '../src/seed'
import { MemoryStore } from '../src/store/memoryStore'

const SECRET = 'test-secret'

let app: ReturnType<typeof createApp>
let dice: [number, number]
let tokens: Record<string, string>

const passwordOf = (username: string) => SEED_USERS.find((u) => u.username === username)!.password

const login = async (username: string) => {
   const res = await request(app).post('/api/auth/login').send({ username, password: passwordOf(username) })
   return res.body.token as string
}

/** The user id of a logged-in test user, read from the token's subject. */
const tokenUserId = (username: string) => jwt.decode(tokens[username])!.sub as string

/** Authenticated request helpers, one per simulated window/user. */
const as = (username: string) => ({
   get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${tokens[username]}`),
   post: (url: string, body?: object) =>
      request(app).post(url).set('Authorization', `Bearer ${tokens[username]}`).send(body),
})

beforeEach(async () => {
   const store = new MemoryStore()
   await seedUsers(store, 4) // low bcrypt cost keeps the tests fast
   dice = [1, 2]
   app = createApp({ store, jwtSecret: SECRET, rollDice: () => dice })
   tokens = { alice: await login('alice'), bob: await login('bob'), carol: await login('carol') }
})

/** alice creates a game, bob joins. Returns the game id. */
const startGame = async (winningScore?: number) => {
   const created = await as('alice').post('/api/games', winningScore ? { winningScore } : {})
   const id = created.body.game.id as string
   await as('bob').post(`/api/games/${id}/join`)
   return id
}

describe('auth', () => {
   it('logs in with valid credentials and never returns the password hash', async () => {
      const res = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'alice123' })
      expect(res.status).toBe(200)
      expect(res.body.token).toBeTruthy()
      expect(res.body.user).toEqual({ id: expect.any(String), username: 'alice', wins: 0 })
      expect(JSON.stringify(res.body)).not.toContain('passwordHash')
   })

   it('rejects a wrong password and an unknown user with the same 401', async () => {
      const wrong = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'nope' })
      const unknown = await request(app).post('/api/auth/login').send({ username: 'nobody', password: 'x' })
      expect(wrong.status).toBe(401)
      expect(unknown.status).toBe(401)
      expect(unknown.body).toEqual(wrong.body)
   })

   it('rejects a login body that fails validation', async () => {
      expect((await request(app).post('/api/auth/login').send({ username: 'alice' })).status).toBe(400)
      expect((await request(app).post('/api/auth/login')).status).toBe(400)
   })

   it('has no register endpoint', async () => {
      const res = await request(app).post('/api/auth/register').send({ username: 'x', password: 'y' })
      expect(res.status).toBe(404)
   })

   it('protects users and games routes', async () => {
      expect((await request(app).get('/api/users')).status).toBe(401)
      expect((await request(app).get('/api/games/current')).status).toBe(401)
      expect((await request(app).post('/api/games')).status).toBe(401)
   })

   it('rejects garbage, wrongly signed, and expired tokens', async () => {
      const get = (token: string) => request(app).get('/api/users').set('Authorization', `Bearer ${token}`)
      expect((await get('garbage')).status).toBe(401)

      const userId = (await request(app).post('/api/auth/login').send({ username: 'alice', password: 'alice123' })).body
         .user.id
      expect((await get(jwt.sign({}, 'another-secret', { subject: userId }))).status).toBe(401)
      expect((await get(jwt.sign({}, SECRET, { subject: userId, expiresIn: -10 }))).status).toBe(401)
      expect((await get(jwt.sign({}, SECRET, { subject: 'no-such-user' }))).status).toBe(401)
   })

   it('lists players with their win counts', async () => {
      const res = await as('bob').get('/api/users')
      expect(res.status).toBe(200)
      expect(res.body.users.map((u: { username: string }) => u.username)).toEqual(['alice', 'bob', 'carol'])
      expect(JSON.stringify(res.body)).not.toContain('passwordHash')
   })
})

describe('two windows: lobby and ready gate', () => {
   it('a game starts only when a second, different user joins', async () => {
      const created = await as('alice').post('/api/games', { winningScore: 50 })
      expect(created.status).toBe(201)
      expect(created.body.game).toMatchObject({ status: 'waiting', winningScore: 50, currentPlayerId: null })
      const id = created.body.game.id

      // alice cannot start a game against herself, and cannot play while waiting
      expect((await as('alice').post(`/api/games/${id}/join`)).status).toBe(409)
      expect((await as('alice').post(`/api/games/${id}/roll`)).status).toBe(409)
      expect((await as('alice').post(`/api/games/${id}/hold`)).status).toBe(409)

      // bob sees it in his lobby, alice does not see her own game there
      const lobbyBob = await as('bob').get('/api/games/open')
      expect(lobbyBob.body.games.map((g: { id: string }) => g.id)).toEqual([id])
      expect((await as('alice').get('/api/games/open')).body.games).toEqual([])

      const joined = await as('bob').post(`/api/games/${id}/join`)
      expect(joined.status).toBe(200)
      expect(joined.body.game.status).toBe('active')
      expect(joined.body.game.players.map((p: { username: string }) => p.username)).toEqual(['alice', 'bob'])
      expect(joined.body.game.currentPlayerId).toBe(created.body.game.players[0].userId)
   })

   it('a third user can neither join nor see a full game', async () => {
      const id = await startGame()
      expect((await as('carol').post(`/api/games/${id}/join`)).status).toBe(409)
      expect((await as('carol').get(`/api/games/${id}`)).status).toBe(403)
      expect((await as('carol').post(`/api/games/${id}/roll`)).status).toBe(403)
      expect((await as('carol').get('/api/games/open')).body.games).toEqual([])
   })

   it('returns the current game, or null', async () => {
      expect((await as('alice').get('/api/games/current')).body).toEqual({ game: null })
      const id = await startGame()
      expect((await as('alice').get('/api/games/current')).body.game.id).toBe(id)
      expect((await as('bob').get('/api/games/current')).body.game.id).toBe(id)
   })

   it('new game abandons the previous one, and the opponent sees it', async () => {
      const first = await startGame()
      const second = await as('alice').post('/api/games')
      expect((await as('bob').get(`/api/games/${first}`)).body.game.status).toBe('abandoned')
      expect(second.body.game.status).toBe('waiting')
      expect((await as('alice').get('/api/games/current')).body.game.id).toBe(second.body.game.id)
   })

   it('leave cancels a waiting game and quits an active one', async () => {
      const created = await as('alice').post('/api/games')
      const cancelled = await as('alice').post(`/api/games/${created.body.game.id}/leave`)
      expect(cancelled.body.game.status).toBe('abandoned')
      expect((await as('bob').get('/api/games/open')).body.games).toEqual([])

      const id = await startGame()
      expect((await as('carol').post(`/api/games/${id}/leave`)).status).toBe(403)
      const quit = await as('bob').post(`/api/games/${id}/leave`)
      expect(quit.body.game).toMatchObject({ status: 'abandoned', winnerId: null })
      expect((await as('alice').post(`/api/games/${id}/roll`)).status).toBe(409)
   })
})

describe('playing', () => {
   it('enforces turns and returns the event with the new state', async () => {
      const id = await startGame()
      dice = [3, 4]
      const rolled = await as('alice').post(`/api/games/${id}/roll`)
      expect(rolled.status).toBe(200)
      expect(rolled.body.event).toBe('rolled')
      expect(rolled.body.game).toMatchObject({ roundScore: 7, lastRoll: [3, 4] })

      expect((await as('bob').post(`/api/games/${id}/roll`)).status).toBe(403)
      expect((await as('bob').post(`/api/games/${id}/hold`)).status).toBe(403)

      const held = await as('alice').post(`/api/games/${id}/hold`)
      expect(held.body.event).toBe('held')
      expect(held.body.game.players[0].score).toBe(7)
      expect(held.body.game.currentPlayerId).toBe(held.body.game.players[1].userId)
   })

   it('a double six loses the round score and passes the turn', async () => {
      const id = await startGame()
      dice = [3, 4]
      await as('alice').post(`/api/games/${id}/roll`)
      dice = [6, 6]
      const bust = await as('alice').post(`/api/games/${id}/roll`)
      expect(bust.body.event).toBe('bust')
      expect(bust.body.game).toMatchObject({ roundScore: 0, lastRoll: [6, 6] })
      expect(bust.body.game.players[0].score).toBe(0)
      expect((await as('bob').post(`/api/games/${id}/roll`)).status).toBe(200)
   })

   it('rejects hold with nothing to bank', async () => {
      const id = await startGame()
      expect((await as('alice').post(`/api/games/${id}/hold`)).status).toBe(409)
   })

   it('the first player to reach the winning score wins, and the win is counted', async () => {
      const id = await startGame(10)
      dice = [5, 5]
      await as('alice').post(`/api/games/${id}/roll`)
      const won = await as('alice').post(`/api/games/${id}/hold`)
      expect(won.body.event).toBe('won')
      expect(won.body.game).toMatchObject({ status: 'finished', currentPlayerId: null })
      expect(won.body.game.winnerId).toBe(won.body.game.players[0].userId)

      expect((await as('bob').post(`/api/games/${id}/roll`)).status).toBe(409)
      const users = (await as('bob').get('/api/users')).body.users
      expect(Object.fromEntries(users.map((u: { username: string; wins: number }) => [u.username, u.wins]))).toEqual({
         alice: 1,
         bob: 0,
         carol: 0,
      })
      // both windows keep seeing the finished game until they start or join another one
      for (const user of ['alice', 'bob']) {
         const current = await as(user).get('/api/games/current')
         expect(current.body.game).toMatchObject({ id, status: 'finished' })
      }
   })

   it("the opponent's current game shows 'abandoned' after the other player leaves", async () => {
      const id = await startGame()
      await as('alice').post(`/api/games/${id}/leave`)
      const current = await as('bob').get('/api/games/current')
      expect(current.body.game).toMatchObject({ id, status: 'abandoned', winnerId: null })
   })
})

describe('acknowledging an ended game', () => {
   it('is remembered per player, so only that player stops seeing the result', async () => {
      const id = await startGame()
      await as('alice').post(`/api/games/${id}/leave`)

      const acked = await as('bob').post(`/api/games/${id}/acknowledge`)
      expect(acked.status).toBe(200)
      expect(acked.body.game.acknowledgedBy).toEqual([tokenUserId('bob')])

      const bobsView = await as('bob').get('/api/games/current')
      expect(bobsView.body.game.acknowledgedBy).toEqual([tokenUserId('bob')])
      const alicesView = await as('alice').get('/api/games/current')
      expect(alicesView.body.game.acknowledgedBy).not.toContain(tokenUserId('alice'))
   })

   it('works for a finished game too, and repeating it is harmless', async () => {
      const id = await startGame(10)
      dice = [5, 5]
      await as('alice').post(`/api/games/${id}/roll`)
      await as('alice').post(`/api/games/${id}/hold`)

      await as('alice').post(`/api/games/${id}/acknowledge`)
      const again = await as('alice').post(`/api/games/${id}/acknowledge`)
      expect(again.status).toBe(200)
      expect(again.body.game.acknowledgedBy).toEqual([tokenUserId('alice')])
   })

   it('rejects strangers (403), games still in play (409), unknown games (404) and missing tokens (401)', async () => {
      const id = await startGame()
      expect((await as('alice').post(`/api/games/${id}/acknowledge`)).status).toBe(409)

      await as('alice').post(`/api/games/${id}/leave`)
      expect((await as('carol').post(`/api/games/${id}/acknowledge`)).status).toBe(403)
      expect((await as('alice').post('/api/games/nope/acknowledge')).status).toBe(404)
      expect((await request(app).post(`/api/games/${id}/acknowledge`)).status).toBe(401)
   })
})

describe('validation and errors', () => {
   it.each([
      ['too small', { winningScore: 5 }],
      ['too large', { winningScore: 1001 }],
      ['not an integer', { winningScore: 50.5 }],
      ['not a number', { winningScore: 'abc' }],
   ])('rejects a winning score that is %s', async (_name, body) => {
      const res = await as('alice').post('/api/games', body)
      expect(res.status).toBe(400)
      expect(res.body.error).toContain('winningScore')
   })

   it('defaults the winning score to 100', async () => {
      expect((await as('alice').post('/api/games')).body.game.winningScore).toBe(100)
   })

   it('returns 404 for unknown games and routes', async () => {
      expect((await as('alice').get('/api/games/nope')).status).toBe(404)
      expect((await as('alice').post('/api/games/nope/join')).status).toBe(404)
      expect((await as('alice').post('/api/games/nope/roll')).status).toBe(404)
      expect((await request(app).get('/api/nothing-here')).status).toBe(404)
   })

   it('returns 400 for malformed JSON', async () => {
      const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad')
      expect(res.status).toBe(400)
   })

   it('serves the health endpoint without auth', async () => {
      const res = await request(app).get('/api/health')
      expect(res.body).toEqual({ ok: true })
   })
})
