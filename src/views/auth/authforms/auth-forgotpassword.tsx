import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";

const AuthForgotPassword = () => {
  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-12">
        <div className="w-full max-w-md flex flex-col gap-6 items-center">

          <div className="text-center flex flex-col gap-1">
            <p className="text-2xl font-medium text-foreground">
              ¿Olvidaste tu contraseña?
            </p>
            <p className="text-sm font-normal text-muted-foreground">
              Introduce la dirección de correo electrónico asociada a tu cuenta y
              te enviaremos un enlace para restablecer tu contraseña.
            </p>
          </div>

          {/* Form */}
          <form className="space-y-6 w-full">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="email"
                  className="text-sm font-normal text-muted-foreground"
                >
                  Correo electrónico*
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@bestronger.es"

                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <Button type="submit" className="rounded-lg">
                ¿Olvidaste tu contraseña?
              </Button>
              <Link to="/auth/auth2/login">
                <Button

                  variant={"outline"}
                  className="rounded-lg w-full"
                >
                  Volver al inicio de sesión
                </Button>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default AuthForgotPassword;
