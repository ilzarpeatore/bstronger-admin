
import { useContext, useEffect, useState } from "react";
import {
  useTable,
  tableFeatures,
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  createPaginatedRowModel,
  sortFn_alphanumeric,
  sortFn_text,
  sortFn_datetime,
  sortFn_basic,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { Pen, Trash2, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipProvider,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchIcon } from "lucide-react";
import { BlogContext } from "src/context/blog-context";
import { BlogPostType } from "src/types/apps/blog";
import { useNavigate } from "react-router";
import PlaceholdersInput from "src/components/animated-components/animatedinput-placeholder";

// TanStack Table v9: cada funcionalidad se registra explícitamente.
// - columnFilteringFeature es requisito de globalFilteringFeature.
// - rowSelectionFeature: casillas y borrado múltiple.
// - Los sortFn_* son los que el sortFn 'auto' de v8 elegía según el tipo de
//   dato, para ordenar igual que antes.
// - columnVisibilityFeature aporta row.getVisibleCells(), que usa el render.
const blogTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
    datetime: sortFn_datetime,
    basic: sortFn_basic,
  },
});

const ManageBlogTable = () => {
  const { posts, blogCategories, fetchPosts, deletePost, toggleStatus, isLoading } = useContext(BlogContext);
  const [tableData, setTableData] = useState<BlogPostType[]>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [blogCategoryFilter, setBlogCategoryFilter] = useState<string>("");
  const [rowSelection, setRowSelection] = useState({});
  const [showSearch, setShowSearch] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [actionDeleteId, setActionDeleteId] = useState<number | null>(null);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const pageSizes = [5, 10, 25, 50];

  const navigate = useNavigate();

  useEffect(() => {
    setTableData(posts);
  }, [posts]);

  const columnHelper = createColumnHelper<typeof blogTableFeatures, BlogPostType>();

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "publish":
      case "active":
        return <Badge className="bg-primary/12! text-primary! text-xs font-medium" variant="secondary">Publicado</Badge>;
      case "draft":
        return <Badge className="bg-yellow-500/12! text-yellow-500! text-xs font-medium" variant="secondary">Borrador</Badge>;
      case "inactive":
        return <Badge className="bg-muted text-muted-foreground text-xs font-medium" variant="secondary">Inactivo</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground text-xs font-medium" variant="secondary">{status || "—"}</Badge>;
    }
  };

  const columns = columnHelper.columns([
    columnHelper.display({
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)}
          className="cursor-pointer"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={!!row.getIsSelected()}
          onCheckedChange={(checked) => row.toggleSelected(checked === true)}
          className="cursor-pointer"
        />
      ),
    }),
    columnHelper.accessor("title", {
      header: "Título",
      cell: (info) => {
        const { title, post_image, coverImg } = info.row.original;
        const img = post_image || coverImg || "";
        return (
          <div className="flex items-center gap-2">
            {img ? (
              <img
                src={img}
                alt={title || ""}
                className="w-12 h-9 object-cover rounded"
                width={48}
                height={36}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-12 h-9 rounded bg-muted" />
            )}
            <span className="text-sm font-medium truncate block text-inherit leading-normal max-w-[250px]">
              {title}
            </span>
          </div>
        );
      },
    }),
    columnHelper.accessor("blog_category", {
      header: "Categoría",
      cell: (info) => {
        const blogCat = info.getValue();
        if (!blogCat) return <span className="text-muted-foreground text-sm">—</span>;
        return (
          <Badge className="bg-primary/12! text-primary! text-xs font-medium" variant="secondary">
            {blogCat.title}
          </Badge>
        );
      },
    }),
    columnHelper.accessor("datetime", {
      header: "Fecha",
      cell: (info) => {
        const dateValue = info.getValue();
        return (
          <span className="text-sm">
            {dateValue ? new Date(dateValue).toLocaleDateString() : "—"}
          </span>
        );
      },
    }),
    columnHelper.accessor("status", {
      header: "Estado",
      cell: ({ row }) => {
        const postId = row.original.id;
        const status = row.original.status || "draft";
        const isPublished = status === "publish" || status === "active";

        const handleToggle = async () => {
          if (postId) {
            await toggleStatus(postId, status);
          }
        };

        return (
          <div className="flex items-center gap-2">
            <Switch checked={isPublished} onCheckedChange={handleToggle} className="cursor-pointer" />
            {getStatusBadge(status)}
          </div>
        );
      },
    }),
    columnHelper.display({
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        const { id } = row.original;

        const handleEdit = () => {
          navigate(`/apps/blog/edit?id=${id}`);
        };

        const handleRowDelete = () => {
          setActionDeleteId(id);
          setShowConfirm(true);
        };

        return (
          <div className="flex items-center gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Button
                    onClick={handleEdit}
                    size="sm"
                    variant="outline"
                    className="h-8! w-8! rounded-md! hover:bg-primary/5 bg-background"
                  >
                    <Pen size={18} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Editar blog</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger>
                  <Button
                    size="sm"
                    onClick={handleRowDelete}
                    variant="outline"
                    className="h-8! w-8! rounded-md! text-destructive! bg-background hover:bg-destructive/5"
                  >
                    <Trash2 size={18} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Eliminar blog</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        );
      },
    }),
  ]);

  const table = useTable({
    features: blogTableFeatures,
    data: tableData,
    columns,
    state: {
      globalFilter,
      rowSelection,
      pagination,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    globalFilterFn: (row, columnId, filterValue) => {
      return String(row.getValue(columnId))
        .toLowerCase()
        .includes(filterValue.toLowerCase());
    },
  });

  const handleDelete = async () => {
    if (actionDeleteId) {
      try {
        await deletePost(actionDeleteId);
      } catch (err) {
        console.error("Failed to delete:", err);
      }
    }
    setRowSelection({});
    setShowConfirm(false);
    setActionDeleteId(null);
  };

  const handleBulkDelete = async () => {
    const selectedIds = table
      .getSelectedRowModel()
      .rows.map((row) => row.original.id)
      .filter(Boolean) as number[];

    for (const id of selectedIds) {
      try {
        await deletePost(id);
      } catch (err) {
        console.error("Failed to delete:", err);
      }
    }
    setRowSelection({});
    setShowConfirm(false);
  };

  const handleSearch = (value: string) => {
    setGlobalFilter(value);
    fetchPosts(1, value, blogCategoryFilter ? Number(blogCategoryFilter) : null);
  };

  const handleCategoryFilter = (value: string | null) => {
    setBlogCategoryFilter(value ?? '');
    fetchPosts(1, globalFilter, value ? Number(value) : null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>
            <h3 className="text-base font-semibold mb-4 md:mb-0">Entradas de blog</h3>
          </CardTitle>
          <div className="flex items-center gap-1 md:gap-2">
            {!showSearch ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Button size="sm" onClick={() => setShowSearch(true)} variant="ghost">
                      <SearchIcon size={16} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Buscar</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <PlaceholdersInput
                value={globalFilter}
                onChange={handleSearch}
                className="pl-3"
                onBlur={() => {
                  if (!globalFilter) setShowSearch(false);
                }}
                placeholders={[
                  "Buscar blogs...",
                  "Buscar los mejores blogs...",
                  "Buscar blogs...",
                ]}
              />
            )}
            <Select
              value={blogCategoryFilter}
              onValueChange={handleCategoryFilter}
            >
              <SelectTrigger className="cursor-pointer w-[180px]">
                <SelectValue>
                  {blogCategoryFilter
                    ? blogCategories.find((c) => String(c.id) === blogCategoryFilter)?.title || "Todas las categorías"
                    : "Todas las categorías"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem className="cursor-pointer" value="all">Todas las categorías</SelectItem>
                {blogCategories.map((cat) => (
                  <SelectItem key={cat.id} className="cursor-pointer" value={String(cat.id)}>
                    {cat.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {table.getIsAllPageRowsSelected() && (
              <Button variant="destructive" onClick={() => setShowConfirm(true)}>
                <Trash2 size={18} />
              </Button>
            )}
            <Button onClick={() => navigate("/apps/blog/create")}>
              <Plus size={18} className="mr-1" /> Añadir entrada
            </Button>
          </div>
        </div>
      </CardHeader>
      <div>
        <CardContent>
          <div className="border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="px-4 py-2 border-b text-left"
                        >
                          {header.isPlaceholder ? null : (
                            <div
                              className={
                                header.column.getCanSort()
                                  ? "cursor-pointer select-none"
                                  : ""
                              }
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              <div className="flex items-center gap-1 text-sm font-semibold">
                                {flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                                {header.column.getCanSort() && (
                                  <>
                                    {header.column.getIsSorted() === "asc" && <ChevronUp size={14} />}
                                    {header.column.getIsSorted() === "desc" && <ChevronDown size={14} />}
                                    {header.column.getIsSorted() === false && <ChevronsUpDown size={14} />}
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={columns.length} className="text-center py-8">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          Cargando entradas...
                        </div>
                      </td>
                    </tr>
                  ) : table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="text-center py-4">
                        <div className="flex flex-col items-center">
                          <img
                            src="/images/svgs/no-data.webp"
                            alt="Sin datos"
                            height={100}
                            width={100}
                            className="mb-4"
                          />
                        </div>
                        No se encontraron entradas de blog. Haz clic en "Añadir entrada" para crear una.
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="border-b last:border-b-0">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-2">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {table.getPageCount() > 0 && (
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-4 gap-3">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Mostrar</p>
                <Select
                  value={String(table.state.pagination.pageSize)}
                  onValueChange={(value) => table.setPageSize(Number(value))}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pageSizes.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">por página</p>
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-normal text-muted-foreground">
                    {table.getRowModel().rows.length > 0
                      ? `${table.state.pagination.pageIndex * table.state.pagination.pageSize + 1}-${Math.min(
                          (table.state.pagination.pageIndex + 1) * table.state.pagination.pageSize,
                          table.getFilteredRowModel().rows.length
                        )} de ${table.getFilteredRowModel().rows.length}`
                      : `0 de 0`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronLeft
                    size={20}
                    className={`text-muted-foreground hover:text-primary cursor-pointer ${
                      table.state.pagination.pageIndex === 0 ? "opacity-50 cursor-not-allowed!" : ""
                    }`}
                    onClick={() => table.previousPage()}
                  />
                  <span className="w-8 h-8 text-primary flex items-center justify-center rounded-md text-sm font-normal">
                    {table.state.pagination.pageIndex + 1}
                  </span>
                  <ChevronRight
                    size={20}
                    className={`text-muted-foreground hover:text-primary cursor-pointer ${
                      table.state.pagination.pageIndex + 1 === table.getPageCount()
                        ? "opacity-50 cursor-not-allowed!"
                        : ""
                    }`}
                    onClick={() =>
                      table.state.pagination.pageIndex + 1 < table.getPageCount() && table.nextPage()
                    }
                  />
                </div>
              </div>
            </div>
          )}

          <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Confirmar eliminación</DialogTitle>
              </DialogHeader>
              <div className="text-center">
                <p className="mb-5 text-lg font-normal text-muted-foreground">
                  ¿Estás seguro de que quieres eliminar esta entrada?
                </p>
              </div>
              <DialogFooter className="flex justify-center gap-4">
                <Button
                  onClick={actionDeleteId ? handleDelete : handleBulkDelete}
                  className="bg-primary/5 text-primary hover:bg-primary/30"
                >
                  Sí, eliminar
                </Button>
                <Button variant="destructive" onClick={() => setShowConfirm(false)}>
                  Cancelar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </div>
    </Card>
  );
};

export default ManageBlogTable;
