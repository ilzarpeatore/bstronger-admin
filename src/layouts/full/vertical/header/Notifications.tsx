import { useCallback, useEffect, useState } from "react";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";
import { Bell } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "src/components/ui/dropdown-menu";
import { Badge } from "src/components/ui/badge";
import { Button } from "src/components/ui/button";
import { cn } from "src/lib/utils";
import { Link, useNavigate } from "react-router";
import { api } from "src/lib/api";
import {
    CATEGORY_META,
    clientLabel,
    formatRelative,
    type ExceptionItem,
} from "src/lib/coachExceptions";

// Campana de notificaciones real (docs/Plan_Cierre_Motor_UI.md, Fase 4) --
// antes alimentada por datos mock (./data). Ahora consume el mismo motor de
// excepciones que el dashboard general y el resumen de cliente, vía el
// endpoint ligero /admin/coach-exceptions/unread-summary (conteo por
// severidad + últimos N pendientes de TODOS los coaches). Alcance acordado:
// solo campana, sin email ni push -- refresco periódico simple con
// setInterval mientras el admin tenga la pestaña abierta.

const REFRESH_MS = 60_000;

type UnreadSummary = {
    counts: { alta: number; media: number; baja: number };
    total: number;
    items: ExceptionItem[];
};

function severityDotClass(item: ExceptionItem): string {
    if (item.category === 'dolor' || item.severity === 'alta') return 'bg-destructive/10 text-destructive';
    if (item.severity === 'media') return 'bg-chart-4/10 text-chart-4';
    return 'bg-muted text-muted-foreground';
}

const Notifications = ({ className }: { className?: string }) => {
    const [summary, setSummary] = useState<UnreadSummary | null>(null);
    const navigate = useNavigate();

    const fetchSummary = useCallback(async () => {
        try {
            const res = await api.get('/admin/coach-exceptions/unread-summary?limit=8');
            const data: UnreadSummary = res.data?.data || res.data;
            if (data) setSummary(data);
        } catch {
            // No bloquear la campana si falla -- mantiene el último dato conocido.
        }
    }, []);

    useEffect(() => {
        fetchSummary();
        const interval = setInterval(fetchSummary, REFRESH_MS);
        return () => clearInterval(interval);
    }, [fetchSummary]);

    const items = summary?.items || [];
    const total = summary?.total ?? 0;

    const handleItemClick = (item: ExceptionItem) => {
        if (item.client_id) {
            navigate(`/users/${item.client_id}/resumen`);
        }
    };

    return (
        <div className={cn("", className)}>
            <DropdownMenu>
                <DropdownMenuTrigger>
                    <div className="relative cursor-pointer">
                        {total > 0 && (
                            <>
                                <span className="h-2.5 w-2.5 bg-destructive rounded-full absolute top-1 end-2 text-xs text-center text-white z-1 animate-ping" />
                                <span className="h-2.5 w-2.5 bg-destructive rounded-full absolute top-1 end-2 text-xs text-center text-white z-1" />
                            </>
                        )}
                        <div className="flex justify-center items-center hover:bg-primary/5 w-10 h-10 rounded-full">
                            <Bell
                                className="size-5"
                            />
                        </div>
                    </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="end"
                    className="w-screen sm:w-[360px] py-6 px-0"
                >
                    <div className="flex items-center px-6 justify-between">
                        <h3 className="text-lg font-semibold">Notificaciones</h3>
                        {total > 0 && (
                            <Badge className="px-3 bg-primary dark:bg-primary hover:bg-primary">{total} pendientes</Badge>
                        )}
                    </div>

                    {/* List */}
                    <SimpleBar className="max-h-80 mt-3">
                        <div className="flex flex-col">
                            {items.length === 0 && (
                                <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                                    Nada pendiente — todo al día.
                                </div>
                            )}
                            {items.map((item) => {
                                const meta = CATEGORY_META[item.category];
                                const Icon = meta?.icon || Bell;
                                const clickable = !!item.client_id;
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => clickable && handleItemClick(item)}
                                        className={cn(
                                            "px-6 py-3 flex justify-between items-center hover:bg-primary/5",
                                            clickable && "cursor-pointer"
                                        )}
                                    >
                                        <div className="flex items-center w-full">
                                            <div
                                                className={cn(
                                                    "h-11 w-11 shrink-0 rounded-full flex justify-center items-center",
                                                    severityDotClass(item)
                                                )}
                                            >
                                                <Icon className="size-5" />
                                            </div>

                                            <div className="ps-4 flex justify-between w-full">
                                                <div className="w-3/4 text-start">
                                                    <h5 className="mb-1 text-sm font-semibold truncate">
                                                        {item.title}
                                                    </h5>
                                                    <div className="text-xs text-muted-foreground line-clamp-1">
                                                        {meta?.label || item.category} · {clientLabel(item)}
                                                    </div>
                                                </div>

                                                <div className="text-xs self-start pt-1.5 dark:text-muted-foreground whitespace-nowrap">
                                                    {formatRelative(item.created_at)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </SimpleBar>

                    {/* Footer Button */}
                    <div className="pt-5 px-6">
                        <Button className="w-full" render={<Link to="/coach-exceptions" />}>
                            Ver todas las excepciones
                        </Button>
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};

export default Notifications;
