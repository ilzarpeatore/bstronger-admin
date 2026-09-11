import { Link } from "react-router";


type SearchType = {
    title: string;
    href: string;
};

const searchSugg: SearchType[] = [
    { title: "Soporte", href: "https://shadcndashboard.dev/support" },
    { title: "Licencia", href: "https://shadcndashboard.dev/license" },
];

export default function Footer() {
    return (
        <div className="flex md:flex-row flex-col items-center justify-between gap-3 text-center">
            <p className="text-sm text-muted-foreground">
                © 2026 por{" "}
                <Link
                    to="https://www.wrappixel.com/" target="_blank"
                    className="hover:text-primary text-muted-foreground"
                >
                    shadcndashboard
                </Link>
                , creando una mejor web para ti.
            </p>

            <div className="flex gap-4">
                {searchSugg.map((item, index) => (
                    <Link
                        key={index}
                        target="_blank"
                        to={item.href}
                        className="text-sm hover:text-primary text-muted-foreground"
                    >
                        {item.title}
                    </Link>
                ))}
            </div>
        </div>
    );
}
