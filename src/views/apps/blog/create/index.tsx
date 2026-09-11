import { useState, useContext } from "react";
import { useNavigate } from "react-router";
import GeneralDetail from "@/components/apps/blog/blogadd/general-detail";
import CategoryTags from "@/components/apps/blog/blogadd/category-tags";
import PostDate from "@/components/apps/blog/blogadd/post-date";
import { Button } from "@/components/ui/button";
import Media from "@/components/apps/blog/blogadd/medias";
import Status from "@/components/apps/blog/blogadd/blog-status";
import Bibliography from "@/components/apps/blog/blogadd/bibliography";
import BlogCategorySelect from "@/components/apps/blog/blogadd/blog-category-select";
import BreadcrumbComp from "src/layouts/full/shared/breadcrumb/BreadcrumbComp";
import StyleAwareWrapper from "src/components/shared/StyleAwareWrapper";
import StyleDivider from "src/components/shared/StyleDivider";
import { BlogContext } from "src/context/blog-context";
import { api } from "src/lib/api";

const BCrumb = [
  { to: "/", title: "Inicio" },
  { title: "Crear Blog" },
];

const BlogCreate = () => {
  const navigate = useNavigate();
  const { fetchPosts } = useContext(BlogContext);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    bibliography: "",
    description: "",
    blog_category_id: null as number | null,
    status: "publish",
    is_featured: false,
    datetime: new Date().toISOString(),
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  const handleSave = async () => {
    if (!formData.title.trim()) {
      alert("El título es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const body = new FormData();
      body.append("title", formData.title);
      body.append("content", formData.content);
      body.append("bibliography", formData.bibliography);
      body.append("description", formData.description || formData.content.replace(/<[^>]*>/g, "").slice(0, 200));
      if (formData.blog_category_id) body.append("blog_category_id", String(formData.blog_category_id));
      body.append("status", formData.status);
      body.append("is_featured", formData.is_featured ? "1" : "0");
      body.append("datetime", formData.datetime);
      if (imageFile) body.append("image", imageFile);

      await api.upload("/admin/posts", body);
      await fetchPosts();
      navigate("/apps/blog/manage-blog");
    } catch (err) {
      console.error("Failed to create post:", err);
      alert("No se pudo crear el post. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="Crear Blog" items={BCrumb} />
      <StyleDivider />
      <StyleAwareWrapper
        lyraClassName="grid grid-cols-12 gap-px bg-border"
        defaultClassName="grid grid-cols-12 gap-[30px]"
      >
        <div className="lg:col-span-8 col-span-12">
          <StyleAwareWrapper
            lyraClassName="flex flex-col gap-px bg-border"
            defaultClassName="flex flex-col gap-[30px]"
          >
            <GeneralDetail formData={formData} setFormData={setFormData} />
            <Media imageFile={imageFile} setImageFile={setImageFile} />
            <Bibliography formData={formData} setFormData={setFormData} />
          </StyleAwareWrapper>
        </div>
        <div className="lg:col-span-4 col-span-12">
          <StyleAwareWrapper
            lyraClassName="flex flex-col gap-px bg-border h-full"
            defaultClassName="flex flex-col gap-[30px]"
          >
            <Status formData={formData} setFormData={setFormData} />
            <BlogCategorySelect formData={formData} setFormData={setFormData} />
            <CategoryTags />
            <PostDate formData={formData} setFormData={setFormData} />
          </StyleAwareWrapper>
        </div>
        <StyleAwareWrapper
          lyraClassName="bg-background col-span-12 p-4"
          defaultClassName="lg:col-span-8 col-span-12"
        >
          <div className="flex gap-3">
            <Button className="sm:mb-0 mb-3 w-fit" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Añadir Blog"}
            </Button>
            <Button variant="destructive" onClick={() => navigate("/apps/blog/manage-blog")}>
              Cancelar
            </Button>
          </div>
        </StyleAwareWrapper>
      </StyleAwareWrapper>
    </StyleAwareWrapper>
  );
};

export default BlogCreate;
