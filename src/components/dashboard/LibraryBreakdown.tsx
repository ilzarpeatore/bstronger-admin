import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardCard } from '@/components/shared/dashboard-card'
import { Layers, type LucideIcon } from 'lucide-react'

type BreakdownItem = {
  id: string
  title: string
  value: number
  icon: LucideIcon
}

function BreakdownCell({ title, value, icon: Icon }: BreakdownItem) {
  return (
    <div className='flex flex-col justify-between p-6 bg-background'>
      <div className='border border-border rounded-md p-2 w-fit'>
        <Icon width={16} height={16} />
      </div>
      <div>
        <h6 className='text-2xl font-semibold'>{value.toLocaleString()}</h6>
        <p className='text-sm font-normal text-muted-foreground'>{title}</p>
      </div>
    </div>
  )
}

export default function LibraryBreakdown({ items }: { items: BreakdownItem[] }) {
  return (
    <DashboardCard className='flex flex-col gap-0! pb-0!'>
      <CardHeader className='border-b border-border'>
        <CardTitle className='flex items-center gap-2'>
          <Layers size={16} className='text-muted-foreground' />
          Biblioteca de contenidos
        </CardTitle>
      </CardHeader>
      <CardContent className='h-full! px-0!'>
        <div className='grid grid-cols-2 sm:grid-cols-3 h-full! gap-px bg-border'>
          {items.map((item) => (
            <BreakdownCell key={item.id} {...item} />
          ))}
        </div>
      </CardContent>
    </DashboardCard>
  )
}
