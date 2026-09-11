import { useState, useContext, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import BreadcrumbComp from "src/layouts/full/shared/breadcrumb/BreadcrumbComp";
import { BlogProvider, BlogContext } from "src/context/blog-context";
import CategoryTags from "@/components/apps/blog/blogedit/category-tags";
import GeneralDetail from "@/components/apps/blog/blogedit/general-detail";
import { Button } from "@/components/ui/button";
import PostDate from "@/components/apps/blog/blogedit/post-date";
import Media from "@/components/apps/blog/blogedit/medias";
import Status from "@/components/apps/blog/blogedit/blog-status";
import Bibliography from "@/components/apps/blog/blogedit/bibliography";
import BlogCategorySelect from "@/components/apps/blog/blogedit/blog-category-select";
import StyleAwareWrapper from "src/components/shared/StyleAwareWrapper";
import StyleDivider from "src/components/shared/StyleDivider";
import { api } from "src/lib/api";
import { BlogPostType } from "src/types/apps/blog";

const BCrumb = [
  { to: "/", title: "Inicio" },
  { title: "Editar Blog" },
];

function BlogEditForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const postId = searchParams.get("id");
  const { fetchPosts } = useContext(BlogContext);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [post, setPost] = useState<BlogPostType | null>(null);

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
  const [existingImage, setExistingImage] = useState<string>("");

  useEffect(() => {
    if (postId) {
      loadPost(Number(postId));
    } else {
      setLoading(false);
    }
  }, [postId]);

  const loadPost = async (id: number) => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/posts/${id}`);
      const p = res.data;
      setPost(p);
      setFormData({
        title: p.title || "",
        content: p.content || p.description || "",
        bibliography: p.bibliography || "",
        description: p.description || "",
        blog_category_id: p.blog_category_id || null,
        status: p.status || "publish",
        is_featured: p.is_featured || false,
        datetime: p.datetime || new Date().toISOString(),
      });
      setExistingImage(p.post_image || "");
    } catch (err) {
      console.error("Failed to load post:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      alert("El título es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const textData: Record<string, any> = {
        title: formData.title,
        content: formData.content,
        bibliography: formData.bibliography,
        description: formData.description || formData.content.replace(/<[^>]*>/g, "").slice(0, 200),
        status: formData.status,
        is_featured: formData.is_featured ? "1" : "0",
        datetime: formData.datetime,
      };
      if (formData.blog_category_id) textData.blog_category_id = formData.blog_category_id;

      await api.put(`/admin/posts/${postId}`, textData);

      if (imageFile) {
        const imageBody = new FormData();
        imageBody.append("image", imageFile);
        await api.upload(`/admin/posts/${postId}/cover-image`, imageBody, 'POST');
      }

      await fetchPosts();
      navigate("/apps/blog/manage-blog");
    } catch (err) {
      console.error("Failed to update post:", err);
      alert("No se pudo actualizar el post. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <StyleAwareWrapper
        lyraClassName="flex flex-col p-px gap-px bg-border"
        defaultClassName="flex flex-col gap-4"
      >
        <BreadcrumbComp title="Editar Blog" items={BCrumb} />
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="ml-3 text-muted-foreground">Cargando el post...</span>
        </div>
      </StyleAwareWrapper>
    );
  }

  if (!post && postId) {
    return (
      <StyleAwareWrapper
        lyraClassName="flex flex-col p-px gap-px bg-border"
        defaultClassName="flex flex-col gap-4"
      >
        <BreadcrumbComp title="Editar Blog" items={BCrumb} />
        <div className="text-center py-20 text-muted-foreground">
          Post no encontrado.
        </div>
      </StyleAwareWrapper>
    );
  }

  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="Blog Edit" items={BCrumb} />
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
            <Media
              imageFile={imageFile}
              setImageFile={setImageFile}
              existingImage={existingImage}
            />
            <Bibliography formData={formData} setFormData={setFormData} />
          </StyleAwareWrapper>
        </div>
        <div className="lg:col-span-4 col-span-12 self-stretch">
          <StyleAwareWrapper
            lyraClassName="flex flex-col gap-px bg-border h-full"
            defaultClassName="flex flex-col gap-[30px]"
          >
            <Status formData={formData} setFormData={setFormData} />
            <BlogCategorySelect formData={formData} setFormData={setFormData} />
            <CategoryTags />
            <div className="flex-1 flex flex-col">
              <PostDate formData={formData} setFormData={setFormData} />
            </div>
          </StyleAwareWrapper>
        </div>
        <StyleAwareWrapper
          lyraClassName="bg-background col-span-12 p-4"
          defaultClassName="lg:col-span-8 col-span-12"
        >
          <div className="flex gap-3">
            <Button className="sm:mb-0 mb-3 w-fit" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
            <Button variant="destructive" onClick={() => navigate("/apps/blog/manage-blog")}>
              Cancelar
            </Button>
          </div>
        </StyleAwareWrapper>
      </StyleAwareWrapper>
    </StyleAwareWrapper>
  );
}

const BlogEdit = () => {
  return (
    <BlogProvider>
      <BlogEditForm />
    </BlogProvider>
  );
};

export default BlogEdit;
