import BreadcrumbComp from "src/layouts/full/shared/breadcrumb/BreadcrumbComp";
import StyleAwareWrapper from "src/components/shared/StyleAwareWrapper";
import StyleDivider from "src/components/shared/StyleDivider";
import CrudView from "src/views/CrudView";
import type { ColumnDef } from "@tanstack/react-table";

const BCrumb = [
  { to: "/", title: "Inicio" },
  { to: "/apps/blog/manage-blog", title: "Blog" },
  { title: "Categorías del Blog" },
];

const columns: ColumnDef<any, any>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: (info) => <span className="text-sm">{info.getValue()}</span>,
  },
  {
    accessorKey: "title",
    header: "Título",
    cell: (info) => <span className="text-sm font-medium">{info.getValue()}</span>,
  },
  {
    accessorKey: "slug",
    header: "Slug",
    cell: (info) => <span className="text-sm text-muted-foreground">{info.getValue()}</span>,
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: (info) => {
      const status = info.getValue();
      return (
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            status === "active"
              ? "bg-primary/12 text-primary"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {status}
        </span>
      );
    },
  },
];

const fields = [
  { name: "title", label: "Título de categoría", type: "text" as const, required: true, placeholder: "p. ej. Entrenamiento, Nutrición, Hábitos" },
  { name: "status", label: "Estado", type: "select" as const, options: [{ label: "Activo", value: "active" }, { label: "Inactivo", value: "inactive" }] },
];

const BlogCategories = () => {
  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="Categorías del Blog" items={BCrumb} />
      <StyleDivider />
      <CrudView
        title="Categorías del Blog"
        endpoint="/admin/blog-categories"
        fields={fields}
        columns={columns}
        paginated
      />
    </StyleAwareWrapper>
  );
};

export default BlogCategories;
