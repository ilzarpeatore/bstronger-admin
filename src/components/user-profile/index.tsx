
// FIX (auditoría 2026-09-13): esta página era 100% mock -- datos de la
// plantilla original (Mathew Anderson, redes sociales de wrappixel/
// shadcndashboard) que nunca se cargaban del backend, y "Guardar" solo
// actualizaba estado local en memoria (se perdía al recargar). El backend
// real (Admin\AuthController) ya tenía GET /admin/me, POST
// /admin/update-profile y POST /admin/change-password -- solo faltaba
// conectarlos aquí. "Dirección"/redes sociales/"Cargo" se quitan del todo:
// no existe ningún campo real para ellos en el modelo de admin, e
// inventar columnas nuevas para rellenar esta página no era el objetivo.

import { Icon } from '@iconify-icon/react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp'
import StyleDivider from '../shared/StyleDivider'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import avatar from "@/assets/images/profile/avtar.webp"

type Personal = {
  first_name: string
  last_name: string
  email: string
  phone_number: string
  user_type: string
}

const EMPTY_PERSONAL: Personal = { first_name: '', last_name: '', email: '', phone_number: '', user_type: '' }

const UserProfile = () => {
  const [loading, setLoading] = useState(true)
  const [personal, setPersonal] = useState<Personal>(EMPTY_PERSONAL)
  const [tempPersonal, setTempPersonal] = useState<Personal>(EMPTY_PERSONAL)
  const [openModal, setOpenModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const [openPasswordModal, setOpenPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ old_password: '', new_password: '', new_password_confirmation: '' })
  const [savingPassword, setSavingPassword] = useState(false)

  const BCrumb = [
    { to: '/', title: 'Inicio' },
    { title: 'Perfil de usuario' },
  ]

  const loadProfile = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/me')
      const d = res.data
      setPersonal({
        first_name: d.first_name || '',
        last_name: d.last_name || '',
        email: d.email || '',
        phone_number: d.phone_number || '',
        user_type: d.user_type || '',
      })
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo cargar el perfil')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProfile() }, [])

  const openEdit = () => {
    setTempPersonal(personal)
    setOpenModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.post('/admin/update-profile', {
        first_name: tempPersonal.first_name,
        last_name: tempPersonal.last_name,
        email: tempPersonal.email,
        phone_number: tempPersonal.phone_number,
      })
      setPersonal(tempPersonal)
      toast.success('Perfil actualizado')
      setOpenModal(false)
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo actualizar el perfil')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (passwordForm.new_password !== passwordForm.new_password_confirmation) {
      toast.error('Las contraseñas nuevas no coinciden')
      return
    }
    setSavingPassword(true)
    try {
      await api.post('/admin/change-password', passwordForm)
      toast.success('Contraseña actualizada')
      setOpenPasswordModal(false)
      setPasswordForm({ old_password: '', new_password: '', new_password_confirmation: '' })
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo cambiar la contraseña')
    } finally {
      setSavingPassword(false)
    }
  }

  const fullName = [personal.first_name, personal.last_name].filter(Boolean).join(' ') || '—'

  return (
    <div className="flex flex-col p-px bg-border gap-px">
      <BreadcrumbComp title="Perfil de usuario" items={BCrumb} />
      <StyleDivider />
      <div className='flex flex-col gap-px bg-border'>
        <Card className='p-6 overflow-hidden'>
          <div className='flex flex-col sm:flex-row items-center gap-6 rounded-xl relative w-full break-words'>
            <div>
              <img src={avatar} alt='image' width={80} height={80} className='rounded-full' />
            </div>
            <div className='flex flex-wrap gap-4 justify-center sm:justify-between items-center w-full'>
              <div className='flex flex-col sm:text-left text-center gap-1.5'>
                <h5 className='card-title'>{loading ? 'Cargando…' : fullName}</h5>
                <p className='text-sm text-gray-500 dark:text-gray-400 capitalize'>{personal.user_type}</p>
              </div>
            </div>
          </div>
        </Card>

        <div className='space-y-6 bg-background md:p-6 p-4 relative w-full break-words'>
          <h5 className='card-title'>Información personal</h5>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-7 2xl:gap-x-32'>
            <div>
              <p className='text-xs text-gray-500'>Nombre</p>
              <p>{personal.first_name || '—'}</p>
            </div>
            <div>
              <p className='text-xs text-gray-500'>Apellidos</p>
              <p>{personal.last_name || '—'}</p>
            </div>
            <div>
              <p className='text-xs text-gray-500'>Correo electrónico</p>
              <p>{personal.email || '—'}</p>
            </div>
            <div>
              <p className='text-xs text-gray-500'>Teléfono</p>
              <p>{personal.phone_number || '—'}</p>
            </div>
          </div>
          <div className='flex justify-end gap-2'>
            <Button variant='outline' onClick={() => setOpenPasswordModal(true)} className='flex items-center gap-1.5 rounded-md'>
              <Icon icon='ic:outline-lock' width='18' height='18' /> Cambiar contraseña
            </Button>
            <Button onClick={openEdit} className='flex items-center gap-1.5 rounded-md' disabled={loading}>
              <Icon icon='ic:outline-edit' width='18' height='18' /> Editar
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle className='mb-4'>Editar información personal</DialogTitle>
          </DialogHeader>

          <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
            <div className='flex flex-col gap-2'>
              <Label htmlFor='firstName'>Nombre</Label>
              <Input
                id='firstName'
                placeholder='Nombre'
                value={tempPersonal.first_name}
                onChange={(e) => setTempPersonal({ ...tempPersonal, first_name: e.target.value })}
              />
            </div>
            <div className='flex flex-col gap-2'>
              <Label htmlFor='lastName'>Apellidos</Label>
              <Input
                id='lastName'
                placeholder='Apellidos'
                value={tempPersonal.last_name}
                onChange={(e) => setTempPersonal({ ...tempPersonal, last_name: e.target.value })}
              />
            </div>
            <div className='flex flex-col gap-2'>
              <Label htmlFor='email'>Correo electrónico</Label>
              <Input
                id='email'
                type='email'
                placeholder='Correo electrónico'
                value={tempPersonal.email}
                onChange={(e) => setTempPersonal({ ...tempPersonal, email: e.target.value })}
              />
            </div>
            <div className='flex flex-col gap-2'>
              <Label htmlFor='phone'>Teléfono</Label>
              <Input
                id='phone'
                placeholder='Teléfono'
                value={tempPersonal.phone_number}
                onChange={(e) => setTempPersonal({ ...tempPersonal, phone_number: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter className='flex gap-2 mt-4'>
            <Button className='rounded-md' onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </Button>
            <Button
              className='rounded-md bg-lighterror dark:bg-darkerror text-error hover:bg-error hover:text-white'
              onClick={() => setOpenModal(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openPasswordModal} onOpenChange={setOpenPasswordModal}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle className='mb-4'>Cambiar contraseña</DialogTitle>
          </DialogHeader>

          <div className='grid grid-cols-1 gap-4'>
            <div className='flex flex-col gap-2'>
              <Label htmlFor='old_password'>Contraseña actual</Label>
              <Input
                id='old_password'
                type='password'
                value={passwordForm.old_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
              />
            </div>
            <div className='flex flex-col gap-2'>
              <Label htmlFor='new_password'>Contraseña nueva</Label>
              <Input
                id='new_password'
                type='password'
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
              />
            </div>
            <div className='flex flex-col gap-2'>
              <Label htmlFor='new_password_confirmation'>Repite la contraseña nueva</Label>
              <Input
                id='new_password_confirmation'
                type='password'
                value={passwordForm.new_password_confirmation}
                onChange={(e) => setPasswordForm({ ...passwordForm, new_password_confirmation: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter className='flex gap-2 mt-4'>
            <Button className='rounded-md' onClick={handleChangePassword} disabled={savingPassword}>
              {savingPassword ? 'Guardando…' : 'Cambiar contraseña'}
            </Button>
            <Button
              className='rounded-md bg-lighterror dark:bg-darkerror text-error hover:bg-error hover:text-white'
              onClick={() => setOpenPasswordModal(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default UserProfile
