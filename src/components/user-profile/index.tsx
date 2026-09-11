


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
import { Link } from 'react-router'
import avatar from "@/assets/images/profile/avtar.webp"

const UserProfile = () => {
  const [openModal, setOpenModal] = useState(false)
  const [modalType, setModalType] = useState<'personal' | 'address' | null>(
    null
  )

  const BCrumb = [
    {
      to: '/',
      title: 'Inicio',
    },
    {
      title: 'Perfil de usuario',
    },
  ]

  const [personal, setPersonal] = useState({
    firstName: 'Mathew',
    lastName: 'Anderson',
    email: 'mathew.anderson@gmail.com',
    phone: '(347) 528-1947',
    position: 'Team Leader',
    facebook: 'https://www.facebook.com/wrappixel',
    twitter: 'https://x.com/shadcndashboard',
    github: 'https://github.com/shadcndashboard',
    dribbble: 'https://dribbble.com/wrappixel',
  })

  const [address, setAddress] = useState({
    location: 'United States',
    state: 'San Diego, California, United States',
    pin: '92101',
    zip: '30303',
    taxNo: 'GA45273910',
  })

  const [tempPersonal, setTempPersonal] = useState(personal)
  const [tempAddress, setTempAddress] = useState(address)

  useEffect(() => {
    if (openModal && modalType === 'personal') {
      setTempPersonal(personal)
    }
    if (openModal && modalType === 'address') {
      setTempAddress(address)
    }
  }, [openModal, modalType, personal, address])

  const handleSave = () => {
    if (modalType === 'personal') {
      setPersonal(tempPersonal)
    } else if (modalType === 'address') {
      setAddress(tempAddress)
    }
    setOpenModal(false)
  }

  const socialLinks = [
    {
      href: 'https://www.facebook.com/wrappixel',
      icon: 'streamline-logos:facebook-logo-2-solid',
    },
    {
      href: 'https://x.com/shadcndashboard',
      icon: 'streamline-logos:x-twitter-logo-solid',
    },
    { href: 'https://github.com/shadcndashboard', icon: 'ion:logo-github' },
    {
      href: 'https://dribbble.com/wrappixel',
      icon: 'streamline-flex:dribble-logo-remix',
    },
  ]

  return (
    <div className="flex flex-col p-px bg-border gap-px">
      <BreadcrumbComp title="Perfil de usuario" items={BCrumb} />
      <StyleDivider />
      <div className='flex flex-col gap-px bg-border'>
        <Card className='p-6 overflow-hidden'>
          <div className='flex flex-col sm:flex-row items-center gap-6 rounded-xl relative w-full break-words'>
            <div>
              <img
                src={avatar}
                alt='image'
                width={80}
                height={80}
                className='rounded-full'
              />
            </div>
            <div className='flex flex-wrap gap-4 justify-center sm:justify-between items-center w-full'>
              <div className='flex flex-col sm:text-left text-center gap-1.5'>
                <h5 className='card-title'>
                  {personal.firstName} {personal.lastName}
                </h5>
                <div className='flex flex-wrap items-center gap-1 md:gap-3'>
                  <p className='text-sm text-gray-500 dark:text-gray-400'>
                    {personal.position}
                  </p>
                  <div className='hidden h-4 w-px bg-gray-300 dark:bg-gray-700 xl:block'></div>
                  <p className='text-sm text-gray-500 dark:text-gray-400'>
                    {address.location}
                  </p>
                </div>
              </div>
              <div className='flex items-center gap-2'>
                {socialLinks.map((item, index) => (
                  <Link
                    key={index}
                    to={item.href}
                    target='_blank'
                    className='flex h-11 w-11 items-center justify-center gap-2 rounded-full shadow-md border border-border hover:bg-gray-50 dark:hover:bg-white/[0.03] dark:hover:text-gray-200'>
                    <Icon icon={item.icon} width='20' height='20' />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className='grid grid-cols-1 xl:grid-cols-2 gap-px'>
          <div className='space-y-6 bg-background md:p-6 p-4 relative w-full break-words'>
            <h5 className='card-title'>Información personal</h5>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-7 2xl:gap-x-32'>
              <div>
                <p className='text-xs text-gray-500'>Nombre</p>
                <p>{personal.firstName}</p>
              </div>
              <div>
                <p className='text-xs text-gray-500'>Apellidos</p>
                <p>{personal.lastName}</p>
              </div>
              <div>
                <p className='text-xs text-gray-500'>Correo electrónico</p>
                <p>{personal.email}</p>
              </div>
              <div>
                <p className='text-xs text-gray-500'>Teléfono</p>
                <p>{personal.phone}</p>
              </div>
              <div>
                <p className='text-xs text-gray-500'>Cargo</p>
                <p>{personal.position}</p>
              </div>
            </div>
            <div className='flex justify-end'>
              <Button
                onClick={() => {
                  setModalType('personal')
                  setOpenModal(true)
                }}
                className='flex items-center gap-1.5 rounded-md'>
                <Icon icon='ic:outline-edit' width='18' height='18' /> Editar
              </Button>
            </div>
          </div>

          <div className='space-y-6 bg-background md:p-6 p-4 relative w-full break-words'>
            <h5 className='card-title'>Datos de dirección</h5>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-7 2xl:gap-x-32'>
              <div>
                <p className='text-xs text-gray-500'>Ubicación</p>
                <p>{address.location}</p>
              </div>
              <div>
                <p className='text-xs text-gray-500'>Provincia / Estado</p>
                <p>{address.state}</p>
              </div>
              <div>
                <p className='text-xs text-gray-500'>Código postal</p>
                <p>{address.pin}</p>
              </div>
              <div>
                <p className='text-xs text-gray-500'>ZIP</p>
                <p>{address.zip}</p>
              </div>
              <div>
                <p className='text-xs text-gray-500'>N.º de identificación fiscal</p>
                <p>{address.taxNo}</p>
              </div>
            </div>
            <div className='flex justify-end'>
              <Button
                onClick={() => {
                  setModalType('address')
                  setOpenModal(true)
                }}
                className='flex items-center gap-1.5 rounded-md'>
                <Icon icon='ic:outline-edit' width='18' height='18' /> Editar
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle className='mb-4'>
              {modalType === 'personal'
                ? 'Editar información personal'
                : 'Editar datos de dirección'}
            </DialogTitle>
          </DialogHeader>

          {modalType === 'personal' ? (
            <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='firstName'>Nombre</Label>
                <Input
                  id='firstName'
                  placeholder='Nombre'
                  value={tempPersonal.firstName}
                  onChange={(e) =>
                    setTempPersonal({
                      ...tempPersonal,
                      firstName: e.target.value,
                    })
                  }
                />
              </div>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='lastName'>Apellidos</Label>
                <Input
                  id='lastName'
                  placeholder='Apellidos'
                  value={tempPersonal.lastName}
                  onChange={(e) =>
                    setTempPersonal({
                      ...tempPersonal,
                      lastName: e.target.value,
                    })
                  }
                />
              </div>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='email'>Correo electrónico</Label>
                <Input
                  id='email'
                  placeholder='Correo electrónico'
                  value={tempPersonal.email}
                  onChange={(e) =>
                    setTempPersonal({ ...tempPersonal, email: e.target.value })
                  }
                />
              </div>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='phone'>Teléfono</Label>
                <Input
                  id='phone'
                  placeholder='Teléfono'
                  value={tempPersonal.phone}
                  onChange={(e) =>
                    setTempPersonal({ ...tempPersonal, phone: e.target.value })
                  }
                />
              </div>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='position'>Cargo</Label>
                <Input
                  id='position'
                  placeholder='Cargo'
                  value={tempPersonal.position}
                  onChange={(e) =>
                    setTempPersonal({
                      ...tempPersonal,
                      position: e.target.value,
                    })
                  }
                />
              </div>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='facebook'>URL de Facebook</Label>
                <Input
                  id='facebook'
                  placeholder='URL de Facebook'
                  value={tempPersonal.facebook}
                  onChange={(e) =>
                    setTempPersonal({
                      ...tempPersonal,
                      facebook: e.target.value,
                    })
                  }
                />
              </div>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='twitter'>URL de Twitter</Label>
                <Input
                  id='twitter'
                  placeholder='URL de Twitter'
                  value={tempPersonal.twitter}
                  onChange={(e) =>
                    setTempPersonal({
                      ...tempPersonal,
                      twitter: e.target.value,
                    })
                  }
                />
              </div>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='github'>URL de GitHub</Label>
                <Input
                  id='github'
                  placeholder='URL de GitHub'
                  value={tempPersonal.github}
                  onChange={(e) =>
                    setTempPersonal({ ...tempPersonal, github: e.target.value })
                  }
                />
              </div>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='dribbble'>URL de Dribbble</Label>
                <Input
                  id='dribbble'
                  placeholder='URL de Dribbble'
                  value={tempPersonal.dribbble}
                  onChange={(e) =>
                    setTempPersonal({
                      ...tempPersonal,
                      dribbble: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          ) : (
            <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='location'>Ubicación</Label>
                <Input
                  id='location'
                  placeholder='Ubicación'
                  value={tempAddress.location}
                  onChange={(e) =>
                    setTempAddress({ ...tempAddress, location: e.target.value })
                  }
                />
              </div>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='state'>Provincia / Estado</Label>
                <Input
                  id='state'
                  placeholder='Provincia / Estado'
                  value={tempAddress.state}
                  onChange={(e) =>
                    setTempAddress({ ...tempAddress, state: e.target.value })
                  }
                />
              </div>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='pin'>Código postal</Label>
                <Input
                  id='pin'
                  placeholder='Código postal'
                  value={tempAddress.pin}
                  onChange={(e) =>
                    setTempAddress({ ...tempAddress, pin: e.target.value })
                  }
                />
              </div>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='zip'>ZIP</Label>
                <Input
                  id='zip'
                  placeholder='ZIP'
                  value={tempAddress.zip}
                  onChange={(e) =>
                    setTempAddress({ ...tempAddress, zip: e.target.value })
                  }
                />
              </div>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='taxNo'>N.º de identificación fiscal</Label>
                <Input
                  id='taxNo'
                  placeholder='N.º de identificación fiscal'
                  value={tempAddress.taxNo}
                  onChange={(e) =>
                    setTempAddress({ ...tempAddress, taxNo: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter className='flex gap-2 mt-4'>
            <Button
              className='rounded-md'
              onClick={handleSave}>
              Guardar cambios
            </Button>
            <Button
              className='rounded-md bg-lighterror dark:bg-darkerror text-error hover:bg-error hover:text-white'
              onClick={() => setOpenModal(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default UserProfile
