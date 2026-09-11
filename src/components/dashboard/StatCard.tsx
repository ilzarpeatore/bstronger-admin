import { CardContent } from '@/components/ui/card'
import { DashboardCard } from '@/components/shared/dashboard-card'
import type { LucideIcon } from 'lucide-react'

type StatCardProps = {
  title: string
  value: number
  icon: LucideIcon
}

export default function StatCard({ title, value, icon: Icon }: StatCardProps) {
  return (
    <DashboardCard className='py-6'>
      <CardContent className='flex justify-between flex-row px-6'>
        <div className='flex flex-col gap-1'>
          <p className='text-sm font-normal text-muted-foreground'>{title}</p>
          <h3 className='text-2xl font-semibold'>{value.toLocaleString()}</h3>
        </div>
        <div className='border border-border p-2.5 w-fit h-fit rounded-md'>
          <Icon size={16} />
        </div>
      </CardContent>
    </DashboardCard>
  )
}
