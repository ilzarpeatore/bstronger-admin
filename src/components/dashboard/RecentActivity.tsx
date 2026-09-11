import { useState } from 'react'
import { History } from 'lucide-react'
import { CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { DashboardCard } from '@/components/shared/dashboard-card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import SimpleBar from 'simplebar-react'

type RecentItem = { id: number; title: string; status?: string; created_at: string }

function formatDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function RecentTable({ items }: { items: RecentItem[] }) {
  if (items.length === 0) {
    return <div className='py-10 text-center text-sm text-muted-foreground'>No hay elementos recientes</div>
  }
  return (
    <SimpleBar>
      <div className='overflow-x-auto'>
        <div className='min-w-[520px]'>
          <Table>
            <TableHeader>
              <TableRow className='hover:bg-transparent border-border'>
                <TableHead className='pl-4! px-4 py-3 h-auto text-sm font-normal text-muted-foreground'>Título</TableHead>
                <TableHead className='px-4 py-3 h-auto text-sm font-normal text-muted-foreground w-[130px]'>Estado</TableHead>
                <TableHead className='pr-4! px-4 py-3 h-auto text-sm font-normal text-muted-foreground w-[140px]'>Creado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className='border-border hover:bg-muted/30'>
                  <TableCell className='pl-4! px-4 py-3'>
                    <span className='text-sm font-medium text-foreground'>{item.title}</span>
                  </TableCell>
                  <TableCell className='px-4 py-3 w-[130px]'>
                    {item.status ? (
                      <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>{item.status}</Badge>
                    ) : (
                      <span className='text-sm text-muted-foreground'>—</span>
                    )}
                  </TableCell>
                  <TableCell className='pr-4! px-4 py-3 w-[140px]'>
                    <span className='text-sm font-normal text-muted-foreground whitespace-nowrap'>
                      {formatDate(item.created_at)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </SimpleBar>
  )
}

export default function RecentActivity({
  workouts,
  diets,
  posts,
  exercises,
}: {
  workouts: RecentItem[]
  diets: RecentItem[]
  posts: RecentItem[]
  exercises: RecentItem[]
}) {
  const [tab, setTab] = useState('workouts')

  return (
    <DashboardCard className='flex flex-col gap-0!'>
      <CardHeader className='border-b border-border'>
        <CardTitle className='flex items-center gap-2'>
          <History size={16} className='text-muted-foreground' />
          Actividad reciente
        </CardTitle>
      </CardHeader>
      <CardContent className='px-0! pt-4'>
        <Tabs value={tab} onValueChange={(v) => v && setTab(v as string)}>
          <TabsList className='mx-4 mb-2'>
            <TabsTrigger value='workouts' className='cursor-pointer'>Entrenamientos</TabsTrigger>
            <TabsTrigger value='diets' className='cursor-pointer'>Dietas</TabsTrigger>
            <TabsTrigger value='posts' className='cursor-pointer'>Entradas</TabsTrigger>
            <TabsTrigger value='exercises' className='cursor-pointer'>Ejercicios</TabsTrigger>
          </TabsList>
          <TabsContent value='workouts'><RecentTable items={workouts} /></TabsContent>
          <TabsContent value='diets'><RecentTable items={diets} /></TabsContent>
          <TabsContent value='posts'><RecentTable items={posts} /></TabsContent>
          <TabsContent value='exercises'><RecentTable items={exercises} /></TabsContent>
        </Tabs>
      </CardContent>
    </DashboardCard>
  )
}
