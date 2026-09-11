import { Button } from "@/components/ui/button";
import { Link } from "react-router";
import errorpage from "@/assets/images/backgrounds/404.svg"

const Error = () => {
  return (
    <>
      <div className="h-screen flex items-center justify-center ">
        <div className="text-center">
          <img
            src={errorpage}
            alt="error"
            className="mb-20"
            width={500}
            height={500}
          />
          <h1 className="text-foreground text-4xl mb-6">¡Ups!!!</h1>
          <h6 className="text-xl text-foreground">
            No se pudo encontrar la página que estás buscando.
          </h6>
          <Button className="mt-6 mx-auto">
            <Link to="/">Volver al inicio</Link>
          </Button>
        </div>
      </div>
    </>
  );
};

export default Error;
