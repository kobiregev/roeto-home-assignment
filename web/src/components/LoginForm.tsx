import { useState, type FormEvent } from 'react'
import { Button } from './Button'

interface Props {
   busy: boolean
   onLogin: (username: string, password: string) => void
}

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2'

export function LoginForm({ busy, onLogin }: Props) {
   const [username, setUsername] = useState('')
   const [password, setPassword] = useState('')

   const submit = (event: FormEvent) => {
      event.preventDefault()
      onLogin(username, password)
   }

   return (
      <form onSubmit={submit} className="space-y-3">
         <h2 className="text-lg font-semibold">Log in</h2>
         <label className="block text-sm font-medium">
            Username
            <input
               className={inputClass}
               value={username}
               onChange={(e) => setUsername(e.target.value)}
               autoComplete="username"
            />
         </label>
         <label className="block text-sm font-medium">
            Password
            <input
               className={inputClass}
               type="password"
               value={password}
               onChange={(e) => setPassword(e.target.value)}
               autoComplete="current-password"
            />
         </label>
         <Button type="submit" disabled={busy || !username || !password} className="w-full">
            Log in
         </Button>
         <p className="text-xs text-slate-500">Demo users: alice, bob, carol. The password is the name plus 123.</p>
      </form>
   )
}
