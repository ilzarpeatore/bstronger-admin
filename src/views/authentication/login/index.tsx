import { Card } from '@/components/ui/card'
import FullLogo from 'src/layouts/full/shared/logo/FullLogo'
import LoginForm from './login-form'

const Login = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-accent px-4">
      <Card className="w-full max-w-md border-none shadow-lg p-6">
        <div className="mx-auto w-fit mb-4">
          <FullLogo />
        </div>
        <LoginForm />
      </Card>
    </div>
  )
}

export default Login
