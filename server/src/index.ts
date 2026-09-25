import { createApp } from './app'
import { seedUsers } from './seed'
import { MemoryStore } from './store/memoryStore'

const port = Number(process.env.PORT ?? 3001)
const jwtSecret = process.env.JWT_SECRET ?? 'dev-only-secret-change-me'

async function main() {
   if (!process.env.JWT_SECRET) console.warn('JWT_SECRET is not set: using an insecure development secret')

   const store = new MemoryStore()
   await seedUsers(store)

   createApp({ store, jwtSecret }).listen(port, () => {
      console.log(`Dice API listening on http://localhost:${port}`)
   })
}

main()
