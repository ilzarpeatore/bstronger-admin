import IconifyIcon from "src/components/icons/iconify-icons";
import BreadcrumbComp from "src/layouts/full/shared/breadcrumb/BreadcrumbComp";
import StyleAwareWrapper from "src/components/shared/StyleAwareWrapper";
import StyleDivider from "src/components/shared/StyleDivider";

const BCrumb = [
  { to: "/", title: "Inicio" },
  { title: "Iconos Iconify" },
];

const page = () => {
  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="Iconos Iconify" items={BCrumb} />
      <StyleDivider />
      <IconifyIcon />
    </StyleAwareWrapper>
  );
};

export default page;
