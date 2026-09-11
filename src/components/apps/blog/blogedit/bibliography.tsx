
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TiptapEdit from "../editor/tiptap-edit";

interface BibliographyProps {
  formData: any;
  setFormData: (fn: (prev: any) => any) => void;
}

const Bibliography = ({ formData, setFormData }: BibliographyProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h5>Bibliografía y fuentes</h5>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-2 block">
          <Label>Bibliografía</Label>
        </div>
        <TiptapEdit
          content={formData.bibliography}
          onChange={(html: string) => setFormData((prev: any) => ({ ...prev, bibliography: html }))}
          placeholder="Añade fuentes, referencias y bibliografía..."
        />
        <small className="text-xs text-muted-foreground">
          Añade referencias, citas y fuentes para tu entrada de blog.
        </small>
      </CardContent>
    </Card>
  );
};

export default Bibliography;
