import { useState } from 'react'
import { WalletIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import PaymentControlForm from './PaymentControlForm'

// Control de impago en la ficha del cliente (/users/:id), debajo del
// entrenador asignado. Solo se enseña a clientes 1:1 (is_personal_client):
// al resto no se les aplica nunca. Ver Bckbs docs/AVISO_IMPAGO.md.
export default function ClientPaymentControlCard({ userId }: { userId: string | number }) {
  const [hidden, setHidden] = useState(false)

  if (hidden) return null

  return (
    <div className={cn('flex flex-col gap-2 rounded-lg border bg-card px-4 py-3')}>
      <p className='flex items-center gap-2 text-sm font-medium'>
        <WalletIcon className='size-4 text-muted-foreground' /> Control de impago
      </p>
      <PaymentControlForm userId={userId} onLoaded={(payload) => setHidden(!payload.applies)} />
    </div>
  )
}
