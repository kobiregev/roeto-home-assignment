import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger'

const variants: Record<Variant, string> = {
   primary: 'bg-indigo-600 text-white hover:bg-indigo-500',
   secondary: 'bg-slate-200 text-slate-800 hover:bg-slate-300',
   danger: 'bg-rose-100 text-rose-700 hover:bg-rose-200',
}

export function Button({
   variant = 'primary',
   className = '',
   ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
   return (
      <button
         type="button"
         className={`rounded-lg px-4 py-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
         {...props}
      />
   )
}
