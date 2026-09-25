import bcrypt from 'bcryptjs'
import type { Store } from './store/store'

// There is no registration: these users exist from startup. Credentials are listed in the README.
export const SEED_USERS = [
   { username: 'alice', password: 'alice123' },
   { username: 'bob', password: 'bob123' },
   { username: 'carol', password: 'carol123' },
]

export async function seedUsers(store: Store, saltRounds = 10): Promise<void> {
   for (const { username, password } of SEED_USERS) {
      await store.createUser({ username, passwordHash: await bcrypt.hash(password, saltRounds) })
   }
}
