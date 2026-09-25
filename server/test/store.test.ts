import bcrypt from 'bcryptjs'
import { beforeEach, describe, expect, it } from 'vitest'
import { createGame, joinGame, leaveGame } from '../src/game/engine'
import { seedUsers, SEED_USERS } from '../src/seed'
import { MemoryStore } from '../src/store/memoryStore'

const alice = { userId: 'a', username: 'alice' }
const bob = { userId: 'b', username: 'bob' }
const carol = { userId: 'c', username: 'carol' }

let store: MemoryStore
beforeEach(() => {
   store = new MemoryStore()
})

describe('users', () => {
   it('creates users with an id and zero wins, and finds them by id and username', async () => {
      const user = await store.createUser({ username: 'alice', passwordHash: 'hash' })
      expect(user.id).toBeTruthy()
      expect(user.wins).toBe(0)
      expect(await store.findUserById(user.id)).toEqual(user)
      expect(await store.findUserByUsername('alice')).toEqual(user)
      expect(await store.findUserByUsername('nobody')).toBeUndefined()
   })

   it('rejects duplicate usernames', async () => {
      await store.createUser({ username: 'alice', passwordHash: 'h' })
      await expect(store.createUser({ username: 'alice', passwordHash: 'h' })).rejects.toThrow()
   })

   it('counts wins', async () => {
      const user = await store.createUser({ username: 'alice', passwordHash: 'h' })
      await store.incrementWins(user.id)
      await store.incrementWins(user.id)
      expect((await store.findUserById(user.id))!.wins).toBe(2)
   })
})

describe('games', () => {
   it('saves and gets a game by id', async () => {
      const game = createGame('g1', alice, 100)
      await store.saveGame(game)
      expect(await store.getGame('g1')).toEqual(game)
      expect(await store.getGame('missing')).toBeUndefined()
   })

   it('saving again replaces the stored game', async () => {
      const waiting = createGame('g1', alice, 100)
      await store.saveGame(waiting)
      await store.saveGame(joinGame(waiting, bob))
      expect((await store.getGame('g1'))!.players).toHaveLength(2)
   })

   it('lists only waiting games in the lobby', async () => {
      const open = createGame('open', alice, 100)
      const full = joinGame(createGame('full', alice, 100), bob)
      const cancelled = leaveGame(createGame('cancelled', alice, 100), 'a')
      for (const g of [open, full, cancelled]) await store.saveGame(g)
      expect((await store.listWaitingGames()).map((g) => g.id)).toEqual(['open'])
   })

   it('finds the most recently created game of a user, whatever its status', async () => {
      expect(await store.findLatestGameFor('a')).toBeUndefined()

      await store.saveGame(createGame('first', alice, 100))
      await store.saveGame(joinGame(createGame('second', carol, 100), alice))
      await store.saveGame(createGame('others', carol, 100))
      expect((await store.findLatestGameFor('a'))!.id).toBe('second')

      // saving a game again (e.g. after it is abandoned) does not change which one is newest
      await store.saveGame(leaveGame(createGame('first', alice, 100), 'a'))
      expect((await store.findLatestGameFor('a'))!.id).toBe('second')
      await store.saveGame(leaveGame(joinGame(createGame('second', carol, 100), alice), 'a'))
      expect((await store.findLatestGameFor('a'))!.status).toBe('abandoned')
   })

   it('lists a users unfinished games only', async () => {
      await store.saveGame(createGame('waiting', alice, 100))
      await store.saveGame(joinGame(createGame('active', alice, 100), bob))
      await store.saveGame(leaveGame(createGame('abandoned', alice, 100), 'a'))
      await store.saveGame(createGame('others', carol, 100))

      expect((await store.listUnfinishedGamesFor('a')).map((g) => g.id).sort()).toEqual(['active', 'waiting'])
      expect((await store.listUnfinishedGamesFor('b')).map((g) => g.id)).toEqual(['active'])
      expect(await store.listUnfinishedGamesFor('nobody')).toEqual([])
   })
})

describe('seedUsers', () => {
   it('creates alice, bob and carol with verifiable, non-plaintext passwords', async () => {
      await seedUsers(store, 4) // low cost keeps the test fast
      const users = await store.listUsers()
      expect(users.map((u) => u.username)).toEqual(['alice', 'bob', 'carol'])
      for (const { username, password } of SEED_USERS) {
         const user = (await store.findUserByUsername(username))!
         expect(user.passwordHash).not.toBe(password)
         expect(await bcrypt.compare(password, user.passwordHash)).toBe(true)
      }
   })
})
