import { Card } from "@/components/ui/card";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import FullLogo from "src/layouts/full/shared/logo/FullLogo";



const BoxedForgotpwd = () => {
  return (
    <>
      <div className="relative overflow-hidden h-screen bg-muted ">
        <div className="flex h-full justify-center items-center px-4">
          <Card className="md:w-112.5 w-full border-none shadow-lg  p-6">
            <div className="mx-auto  w-fit">
              <FullLogo />
            </div>
            <p className="text-sm font-normal text-muted-foreground">
              Introduce la dirección de correo electrónico asociada a tu cuenta y
              te enviaremos un enlace para restablecer tu contraseña.
            </p>
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
                    placeholder="example@shadcndashboard.com"

                    required
                  />
                </div>
              </div>

              <Button className="w-full rounded-lg">
                ¿Olvidaste tu contraseña?
              </Button>
            </form>
            <Button className="w-full " variant={"outline"}>
              <Link to="/auth/auth2/login">Volver al inicio de sesión</Link>
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
};

export default BoxedForgotpwd;
