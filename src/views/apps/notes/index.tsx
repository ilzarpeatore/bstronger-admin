import NotesApp from "src/components/apps/notes";
import BreadcrumbComp from "src/layouts/full/shared/breadcrumb/BreadcrumbComp";
import StyleAwareWrapper from "src/components/shared/StyleAwareWrapper";
import StyleDivider from "src/components/shared/StyleDivider";

const BCrumb = [
  { to: "/", title: "Inicio" },
  { title: "Notas" },
];

const Notes = () => {
  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="App de Notas" items={BCrumb} />
      <StyleDivider />
      <NotesApp />
    </StyleAwareWrapper>
  );
};

export default Notes;
