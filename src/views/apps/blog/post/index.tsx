import BlogPost from "src/components/apps/blog/blog-post";
import BreadcrumbComp from "src/layouts/full/shared/breadcrumb/BreadcrumbComp";
import StyleAwareWrapper from "src/components/shared/StyleAwareWrapper";
import StyleDivider from "src/components/shared/StyleDivider";

const BCrumb = [
  { to: "/", title: "Inicio" },
  { title: "App de Blog" },
];

const Blog = () => {
  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="App de Blog" items={BCrumb} />
      <StyleDivider />
      <BlogPost />
    </StyleAwareWrapper>
  );
};
export default Blog;
