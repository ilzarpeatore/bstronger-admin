
import { useContext } from "react";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BlogContext } from "src/context/blog-context";

interface BlogCategorySelectProps {
  formData: any;
  setFormData: (fn: (prev: any) => any) => void;
}

const BlogCategorySelect = ({ formData, setFormData }: BlogCategorySelectProps) => {
  const { blogCategories } = useContext(BlogContext);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h5>Categoría del blog</h5>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-2 block">
          <Label>Seleccionar categoría</Label>
        </div>
        <Select
          value={formData.blog_category_id ? String(formData.blog_category_id) : ""}
          onValueChange={(value) =>
            setFormData((prev: any) => ({
              ...prev,
              blog_category_id: value ? Number(value) : null,
            }))
          }
        >
          <SelectTrigger className="cursor-pointer">
            <SelectValue placeholder="Elige una categoría" />
          </SelectTrigger>
          <SelectContent>
            {blogCategories.length === 0 ? (
              <SelectItem value="none" disabled>
                No hay categorías disponibles
              </SelectItem>
            ) : (
              blogCategories.map((cat) => (
                <SelectItem key={cat.id} className="cursor-pointer" value={String(cat.id)}>
                  {cat.title}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <small className="text-xs text-muted-foreground">
          Elige la categoría para esta entrada de blog.
        </small>
      </CardContent>
    </Card>
  );
};

export default BlogCategorySelect;
