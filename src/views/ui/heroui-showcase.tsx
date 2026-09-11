import "@heroui/styles/css";

import { Chip } from "@heroui/react";
import { Surface } from "@heroui/react";
import { Separator } from "@heroui/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@heroui/react";
import { ProgressCircle, ProgressCircleTrack, ProgressCircleFillCircle, ProgressCircleTrackCircle } from "@heroui/react";
import { Button } from "@heroui/react";
import { ScrollShadow } from "@heroui/react";
import { Tag, TagGroup } from "@heroui/react";
import { Link } from "@heroui/react";

export default function HeroUIShowcase() {
  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Componentes HeroUI</h1>
        <p className="text-muted-foreground text-sm">
          Componentes HeroUI v3 útiles que complementan el conjunto shadcn/ui existente.
        </p>
      </div>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Chip</h2>
        <p className="text-muted-foreground text-xs">
          Componente tipo etiqueta con opciones de color, tamaño y variante.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <Chip color="default">Predeterminado</Chip>
          <Chip color="accent">Acento</Chip>
          <Chip color="success">Éxito</Chip>
          <Chip color="warning">Advertencia</Chip>
          <Chip color="danger">Peligro</Chip>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Chip size="sm">Pequeño</Chip>
          <Chip size="md">Mediano</Chip>
          <Chip size="lg">Grande</Chip>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Chip variant="primary">Primario</Chip>
          <Chip variant="secondary">Secundario</Chip>
          <Chip variant="soft">Suave</Chip>
          <Chip variant="tertiary">Terciario</Chip>
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Tag / TagGroup</h2>
        <p className="text-muted-foreground text-xs">
          Etiquetas removibles para filtrar y categorizar.
        </p>
        <TagGroup aria-label="Etiquetas">
          <Tag>React</Tag>
          <Tag>TypeScript</Tag>
          <Tag>Tailwind</Tag>
          <Tag>HeroUI</Tag>
        </TagGroup>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Progress Circle</h2>
        <p className="text-muted-foreground text-xs">
          Indicador de progreso circular con variantes de color.
        </p>
        <div className="flex gap-6 items-center">
          <div className="flex flex-col items-center gap-1">
            <ProgressCircle value={25} size="sm" aria-label="25%">
              <ProgressCircleTrack>
                <ProgressCircleTrackCircle />
                <ProgressCircleFillCircle />
              </ProgressCircleTrack>
            </ProgressCircle>
            <span className="text-xs text-muted-foreground">25%</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ProgressCircle value={50} color="accent" size="md" aria-label="50%">
              <ProgressCircleTrack>
                <ProgressCircleTrackCircle />
                <ProgressCircleFillCircle />
              </ProgressCircleTrack>
            </ProgressCircle>
            <span className="text-xs text-muted-foreground">50%</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ProgressCircle value={75} color="success" size="lg" aria-label="75%">
              <ProgressCircleTrack>
                <ProgressCircleTrackCircle />
                <ProgressCircleFillCircle />
              </ProgressCircleTrack>
            </ProgressCircle>
            <span className="text-xs text-muted-foreground">75%</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ProgressCircle value={100} color="warning" size="lg" aria-label="100%">
              <ProgressCircleTrack>
                <ProgressCircleTrackCircle />
                <ProgressCircleFillCircle />
              </ProgressCircleTrack>
            </ProgressCircle>
            <span className="text-xs text-muted-foreground">100%</span>
          </div>
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Card (HeroUI)</h2>
        <p className="text-muted-foreground text-xs">
          Tarjeta con estilos integrados mediante propiedades CSS personalizadas.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Título de la tarjeta</CardTitle>
              <CardDescription>La descripción de la tarjeta va aquí</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs">Área de contenido para el cuerpo de la tarjeta.</p>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">Pie de la tarjeta</p>
            </CardFooter>
          </Card>
          <Surface className="p-4 rounded-lg">
            <h3 className="text-sm font-medium">Contenedor de superficie</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Una Surface es como una tarjeta pero más ligera: útil para agrupar contenido.
            </p>
          </Surface>
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Button (HeroUI)</h2>
        <p className="text-muted-foreground text-xs">
          Botón con opciones de variante. Se puede usar junto a los botones shadcn existentes.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <Button variant="primary">Primario</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="tertiary">Terciario</Button>
          <Button variant="outline">Contorno</Button>
          <Button variant="danger">Peligro</Button>
          <Button variant="danger-soft">Peligro suave</Button>
          <Button variant="ghost">Fantasma</Button>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button size="sm">Pequeño</Button>
          <Button size="md">Mediano</Button>
          <Button size="lg">Grande</Button>
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Scroll Shadow</h2>
        <p className="text-muted-foreground text-xs">
          Contenedor con sombras degradadas en los bordes al hacer scroll.
        </p>
        <ScrollShadow className="h-32 w-80 border rounded-md p-3 text-xs">
          <div className="space-y-2">
            <p>Desplázate hacia abajo para ver el efecto de sombra...</p>
            {Array.from({ length: 8 }).map((_, i) => (
              <p key={i}>Elemento {i + 1}: la sombra de scroll aparece en el borde inferior.</p>
            ))}
          </div>
        </ScrollShadow>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Link</h2>
        <p className="text-muted-foreground text-xs">
          Componente de enlace con estilos que usa React Aria.
        </p>
        <div className="flex gap-4 items-center">
          <Link href="#">Enlace predeterminado</Link>
          <Link href="#" className="text-accent font-medium">Enlace de acento</Link>
        </div>
      </section>
    </div>
  );
}
