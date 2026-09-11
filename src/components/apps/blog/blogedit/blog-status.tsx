
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StatusProps {
  formData: any;
  setFormData: (fn: (prev: any) => any) => void;
}

const Status = ({ formData, setFormData }: StatusProps) => {
  const statuses = [
    { value: "publish", label: "Publicar" },
    { value: "draft", label: "Borrador" },
    { value: "inactive", label: "Inactivo" },
  ];

  const statusColors: Record<string, string> = {
    publish: "bg-chart-2",
    draft: "bg-yellow-500",
    inactive: "bg-muted",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex justify-between items-center">
            <h5>Estado del blog</h5>
            <span className={`h-3 w-3 p-0 rounded-full ${statusColors[formData.status] || "bg-muted"}`} />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData((prev: any) => ({ ...prev, status: value }))}
          >
            <SelectTrigger className="w-full" id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Estado</SelectLabel>
                {statuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <small className="text-xs text-muted-foreground">
            Establece el estado del blog.
          </small>
        </div>
      </CardContent>
    </Card>
  );
};

export default Status;
