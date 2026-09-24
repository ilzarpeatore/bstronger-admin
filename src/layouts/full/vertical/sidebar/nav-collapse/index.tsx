import { Link, useLocation } from "react-router";
import NavItem from "../nav-items/index";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { MenuItem, ChildItem } from "../sidebaritems";
import { ChevronRight } from "lucide-react";

interface NavCollapseProps {
  menu: MenuItem[];
  className?: string;
}

export default function NavCollapse({ menu, className }: NavCollapseProps) {
  const { pathname } = useLocation();
  const { state } = useSidebar();
  const isCollapse = state === "collapsed";

  const isActiveRoute = (item: ChildItem): boolean => {
    if (item.url && pathname === item.url) return true;
    if (item.items) return item.items.some(isActiveRoute);
    return false;
  };

  const renderChildItem = (item: ChildItem, index: number) => {
    const hasChildren =
      Array.isArray(item.items) && item.items.length > 0;
    const active = isActiveRoute(item);

    // 👉 No children → direct link
    if (!hasChildren)
      return (
        <Link
          key={index}
          to={item.url || "#"}
          target={item.external ? "_blank" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-md transition-all duration-200 ease-in-out",
            className,
          )}
        >
          <NavItem item={item} hasChildren={false} isActive={active} />
        </Link>
      );

    // 👉 With children → collapsible
    return (
      <details
        key={index}
        className="group/nav"
        open={active || item.isActive}
      >
        <summary
          className={cn(
            "cursor-pointer rounded-md flex items-center transition-all duration-200 ease-in-out list-none [&::-webkit-details-marker]:hidden",
          )}
        >
          <NavItem
            item={item}
            hasChildren={true}
            className={className}
            isActive={active}
          />
        </summary>

        <div className="pl-3 ml-5 border-l border-border">
          {item.items?.map((sub: ChildItem, index) =>
            // Submenú anidado: se pinta como grupo con su propio nombre. Antes se
            // reinvocaba NavCollapse con una sección sin `heading`, lo que
            // creaba una fila raíz sin nombre (y cerrada) alrededor del grupo.
            sub.items ? (
              renderChildItem(sub, index)
            ) : (
              <Link
                key={index}
                to={sub.url || "#"}
                target={sub.external ? "_blank" : undefined}
                className={cn(
                  "block rounded-md transition-all duration-200 ease-in-out",
                  className,
                )}
              >
                <NavItem item={sub} hasChildren={false} className={cn("px-2! py-1! my-1!", pathname === sub.url && "bg-primary/5 text-primary")} isActive={pathname === sub.url} />
              </Link>
            )
          )}
        </div>
      </details>
    );
  };

  return (
    <>
      {menu.map((section, index) => {
        // 👉 Collapsed (icon-only) mode: keep the compact heading + items
        if (isCollapse) {
          return (
            <div key={index}>
              <span
                className={cn(
                  "text-xs uppercase block font-semibold text-muted-foreground mb-2 transition-all duration-200",
                  "text-center group-hover:text-start group-data-[state=expanded]:text-start",
                )}
              >
                <span className="group-hover:hidden group-data-[state=expanded]:hidden">...</span>
                <span className="hidden group-hover:inline group-data-[state=expanded]:inline">{section.heading ?? ""}</span>
              </span>
              {section.items?.map(renderChildItem)}
            </div>
          );
        }

        const active = !!section.items?.some(isActiveRoute);

        // 👉 Expanded mode: collapsible section (open only the active one)
        return (
          <details
            key={index}
            className="group/section"
            open={active}
          >
            <summary
              className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-xs uppercase font-semibold text-muted-foreground transition-all duration-200 select-none hover:text-foreground list-none [&::-webkit-details-marker]:hidden"
            >
              <span className={cn(active && "text-primary")}>{section.heading ?? ""}</span>
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-open/section:rotate-90",
                  active && "text-primary",
                )}
              />
            </summary>

            <div className="mb-1 pb-1">
              {section.items?.map(renderChildItem)}
            </div>
          </details>
        );
      })}
    </>
  );
}
