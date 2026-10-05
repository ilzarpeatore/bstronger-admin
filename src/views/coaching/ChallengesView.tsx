import { useCallback, useEffect, useMemo, useState } from 'react'
import { LockIcon, PlusIcon, UsersIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import ChallengeWizard, { type Option } from './challenges/ChallengeWizard'
import ChallengeDetailDialog from './challenges/ChallengeDetailDialog'
import {
  LIST_TABS,
  STATUS_LABEL,
  formatValue,
  groupByTab,
  unwrapList,
  type Challenge,
  type ChallengeDetail,
  type ChallengeMetric,
  type ListTab,
} from './challenges/challengeForm'

// Retos entre clientes (contrato: retos/contrato-api.md). Abiertos: se apunta quien
// cumpla los criterios. Cerrados: el coach invita. Los clientes se ven por su alias.
const ChallengesView = () => {
  const [items, setItems] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<ListTab>('active')
  const [metrics, setMetrics] = useState<ChallengeMetric[]>([])
  const [programs, setPrograms] = useState<Option[]>([])
  const [habitTemplates, setHabitTemplates] = useState<Option[]>([])

  const [wizardOpen, setWizardOpen] = useState(false)
  const [editing, setEditing] = useState<ChallengeDetail | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/challenge-list')
      setItems(unwrapList<Challenge>(res))
    } catch {
      toast.error('Error al cargar los retos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  useEffect(() => {
    api.get('/admin/challenge-metrics')
      .then(res => setMetrics(unwrapList<ChallengeMetric>(res).map(m => ({ ...m, formats: m.formats ?? ['threshold'], params: m.params ?? [] }))))
      .catch(() => toast.error('Error al cargar el catálogo de métricas'))
    api.get('/admin/training-program-list?per_page=500')
      .then(res => setPrograms(unwrapList<{ id: number; title?: string; name?: string }>(res).map(p => ({ id: p.id, title: p.title || p.name || `Programa #${p.id}` }))))
      .catch(() => { /* el selector queda en «Cualquier programa» */ })
    api.get('/admin/habit-list?templates=1')
      .then(res => setHabitTemplates(unwrapList<{ id: number; title: string }>(res).map(h => ({ id: h.id, title: h.title }))))
      .catch(() => { /* solo hace falta para la métrica de hábitos */ })
  }, [])

  const grouped = useMemo(() => groupByTab(items), [items])
  const metricLabel = (c: Challenge) => c.metric_label || metrics.find(m => m.key === c.metric_key)?.label || c.metric_key || '—'
  const metricUnit = (c: Challenge) => c.unit ?? metrics.find(m => m.key === c.metric_key)?.unit ?? null

  const openCreate = () => {
    setEditing(null)
    setWizardOpen(true)
  }

  const openEdit = (detail: ChallengeDetail) => {
    setDetailId(null)
    setEditing(detail)
    setWizardOpen(true)
  }

  const rows = grouped[tab]

  return (
    <>
      <Card>
        <CardHeader className='flex flex-row flex-wrap items-center justify-between gap-2'>
          <CardTitle>Retos</CardTitle>
          <Button onClick={openCreate}>
            <PlusIcon className='mr-2 size-4' /> Nuevo reto
          </Button>
        </CardHeader>
        <CardContent className='flex flex-col gap-4'>
          <Tabs value={tab} onValueChange={v => setTab(v as ListTab)}>
            <TabsList className='h-auto flex-wrap'>
              {LIST_TABS.map(t => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                  <span className='ml-1 text-xs tabular-nums text-muted-foreground'>{grouped[t.value].length}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Métrica</TableHead>
                  <TableHead>Formato</TableHead>
                  <TableHead>Fechas</TableHead>
                  <TableHead className='text-right'>Participantes</TableHead>
                  {tab === 'closed' && <TableHead>Estado</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className='h-24 text-center'>
                      <div className='flex justify-center'>
                        <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : rows.length ? (
                  rows.map(c => (
                    <TableRow key={c.id} className='cursor-pointer' onClick={() => setDetailId(c.id)}>
                      <TableCell>
                        <div className='font-medium'>{c.title}</div>
                        {c.prize && <div className='text-xs text-muted-foreground'>Premio: {c.prize}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant='outline' className='gap-1'>
                          {c.visibility === 'open' ? <UsersIcon className='size-3' /> : <LockIcon className='size-3' />}
                          {c.visibility === 'open' ? 'Abierto' : 'Cerrado'}
                        </Badge>
                        {c.paid_only && <Badge variant='secondary' className='ml-1'>Pago</Badge>}
                      </TableCell>
                      <TableCell>{metricLabel(c)}</TableCell>
                      <TableCell>{c.format === 'threshold' ? `Objetivo ${formatValue(c.threshold_value, metricUnit(c))}` : 'Ranking'}</TableCell>
                      <TableCell className='whitespace-nowrap'>{c.start_date || '—'} → {c.end_date || '—'}</TableCell>
                      <TableCell className='text-right tabular-nums'>
                        {c.participants_count ?? 0}
                        {c.visibility === 'closed' && c.invited_count ? <span className='text-muted-foreground'> (+{c.invited_count} inv.)</span> : null}
                      </TableCell>
                      {tab === 'closed' && (
                        <TableCell><Badge variant={c.status === 'cancelled' ? 'destructive' : 'secondary'}>{STATUS_LABEL[c.status]}</Badge></TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className='h-24 text-center text-muted-foreground'>
                      No hay retos en «{LIST_TABS.find(t => t.value === tab)?.label}».
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ChallengeWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        editing={editing}
        metrics={metrics}
        programs={programs}
        habitTemplates={habitTemplates}
        onSaved={id => { fetchItems(); if (id) setDetailId(id) }}
      />

      <ChallengeDetailDialog
        challengeId={detailId}
        onClose={() => setDetailId(null)}
        metrics={metrics}
        onEdit={openEdit}
        onChanged={fetchItems}
      />
    </>
  )
}

export default ChallengesView
