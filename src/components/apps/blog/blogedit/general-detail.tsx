
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TiptapEdit from "../editor/tiptap-edit";

interface GeneralDetailProps {
  formData: any;
  setFormData: (fn: (prev: any) => any) => void;
}

const GeneralDetail = ({ formData, setFormData }: GeneralDetailProps) => {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            <h5>Detalles del blog</h5>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="mb-2">
              <Label htmlFor="prednm">
                Título del blog <span className="text-destructive">*</span>
              </Label>
            </div>
            <Input
              id="prednm"
              type="text"
              placeholder="Título del blog"
              value={formData.title}
              onChange={(e) => setFormData((prev: any) => ({ ...prev, title: e.target.value }))}
            />
            <small className="text-xs text-muted-foreground">
              El título del blog es obligatorio y se recomienda que sea único.
            </small>
          </div>
          <div>
            <div className="mb-2 block">
              <Label htmlFor="desc">Contenido</Label>
            </div>
            <TiptapEdit
              content={formData.content}
              onChange={(html: string) => setFormData((prev: any) => ({ ...prev, content: html }))}
            />
            <small className="text-xs text-muted-foreground">
              Escribe el contenido de tu blog. Admite texto, imágenes, incrustaciones de YouTube y formato.
            </small>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default GeneralDetail;
