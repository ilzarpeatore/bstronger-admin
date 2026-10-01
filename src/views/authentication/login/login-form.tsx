import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { useAuth } from '@/context/auth-context/AuthContext'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'

const LoginForm = () => {
  const [isVisible, setIsVisible] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await login(email, password)
      toast.success('¡Inicio de sesión correcto!')
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err?.message || 'Correo electrónico o contraseña no válidos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup className="gap-4">
        <Field className="gap-2">
          <FieldLabel htmlFor="userEmail" className="leading-5">
            Correo electrónico
          </FieldLabel>
          <Input
            type="email"
            id="userEmail"
            placeholder="admin@admin.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </Field>

        <Field className="w-full gap-2">
          <FieldLabel htmlFor="password" className="leading-5">
            Contraseña
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="password"
              type={isVisible ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <InputGroupAddon align="inline-end" className="pr-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsVisible(prevState => !prevState)}
                className="text-muted-foreground rounded-l-none hover:bg-transparent"
              >
                {isVisible ? <EyeOffIcon /> : <EyeIcon />}
                <span className="sr-only">{isVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}</span>
              </Button>
            </InputGroupAddon>
          </InputGroup>
        </Field>

        <Field>
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? 'Iniciando sesión...' : 'Iniciar sesión en Be Stronger'}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}

export default LoginForm
