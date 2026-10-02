import { useState } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'

// Alta de un cliente que no tiene cuenta en la app: solo existe en el
// seguimiento de pagos para poder registrar sus mensualidades.
export default function AddExternalClientDialog({ open, onOpenChange, onCreated }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [fee, setFee] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setName('')
    setEmail('')
    setFee('')
    setNotes('')
    setError(null)
  }

  const handleSubmit = async () => {
    const monthlyFee = Number(fee || 0)
    if (!name.trim()) return setError('El nombre es obligatorio.')
    if (Number.isNaN(monthlyFee) || monthlyFee < 0) return setError('La tarifa no es válida.')
    setSaving(true)
    setError(null)
    try {
      await api.post('/admin/subscription-payments/external', {
        name: name.trim(),
        email: email.trim() || null,
        monthly_fee: monthlyFee,
        notes: notes.trim() || null,
      })
      reset()
      onOpenChange(false)
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el cliente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="sm:max-w-md!">
        <DialogHeader>
          <DialogTitle>Añadir cliente no registrado</DialogTitle>
          <DialogDescription>
            Para clientes que pagan pero no tienen cuenta en la app. Podrás marcar sus mensualidades igual que las del resto.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          <Field className="gap-2">
            <FieldLabel>Nombre *</FieldLabel>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellidos" />
          </Field>
          <Field className="gap-2">
            <FieldLabel>Email (opcional)</FieldLabel>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field className="gap-2">
            <FieldLabel>Tarifa mensual (€)</FieldLabel>
            <Input type="number" min={0} step={0.01} value={fee} onChange={(e) => setFee(e.target.value)} />
          </Field>
          <Field className="gap-2">
            <FieldLabel>Notas (opcional)</FieldLabel>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving} className="cursor-pointer">
            {saving ? 'Guardando...' : 'Añadir cliente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
