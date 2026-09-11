import { Card } from "@/components/ui/card";
import { Link } from "react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import FullLogo from "src/layouts/full/shared/logo/FullLogo";
import SocialButtons from "../../authforms/social-buttons";




const BoxedLogin = () => {
  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-accent  px-4">
        <Card className="w-full max-w-md border-none shadow-lg p-6">
          {/* Logo */}
          <div className="mx-auto  w-fit">
            <FullLogo />
          </div>

          <SocialButtons />
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
                  placeholder="Introduce tu correo electrónico"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className="text-sm font-normal text-muted-foreground"
                >
                  Contraseña*
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Introduce tu contraseña"
                  required
                />
              </div>
              <div className="flex items-center justify-between text-sm flex-wrap gap-4">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="remember"
                    className={"cursor-pointer"}
                  />
                  <Label
                    htmlFor="remember"
                    className="text-muted-foreground font-normal cursor-pointer leading-0"
                  >
                    Recordar este dispositivo
                  </Label>
                </div>
                <a
                  href="/auth/auth2/forgot-password"
                  className=" text-sm font-medium hover:underline underline-offset-4 transition-all"
                >
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
            </div>
            <Button
              size="lg"
              className="w-full rounded-lg"
            >
              Iniciar sesión
            </Button>
          </form>
          {/* Footer */}
          <div className="flex gap-2 text-base font-medium mt-4 items-center justify-center">
            <p className="text-muted-foreground">¿Nuevo en ShadcnDashboard?</p>
            <Link
              to={"/auth/auth2/register"}
              className="text-primary/80 hover:text-primary text-sm font-medium"
            >
              Crear cuenta
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
};

export default BoxedLogin;
