import type { User } from '../api/types'

export function Wins({ users }: { users: User[] }) {
   const ranking = [...users].sort((a, b) => b.wins - a.wins)
   return (
      <section aria-label="Wins" className="mt-6 border-t border-slate-200 pt-4">
         <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Wins</h3>
         <ul className="flex flex-wrap gap-2">
            {ranking.map((user) => (
               <li key={user.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm">
                  {user.username} <span className="font-bold">{user.wins}</span>
               </li>
            ))}
         </ul>
      </section>
   )
}
