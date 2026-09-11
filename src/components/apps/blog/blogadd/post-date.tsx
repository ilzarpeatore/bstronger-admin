
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PostDateProps {
  formData: any;
  setFormData: (fn: (prev: any) => any) => void;
}

const PostDate = ({ formData, setFormData }: PostDateProps) => {
  const currentDate = formData.datetime ? new Date(formData.datetime) : new Date();

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>
          <h5>Fecha de publicación</h5>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <div className="mb-2">
            <Label htmlFor="publishDate">
              Selecciona la fecha de publicación
              <span className="text-destructive">*</span>
            </Label>
          </div>
          <div>
            <Popover>
              <PopoverTrigger className="w-full">
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !currentDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon />
                  {currentDate ? format(currentDate, "PPP") : <span>Elige una fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start">
                <Calendar
                  mode="single"
                  selected={currentDate}
                  onSelect={(date) => {
                    if (date) {
                      setFormData((prev: any) => ({ ...prev, datetime: date.toISOString() }));
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
          <small className="text-xs text-muted-foreground">
            Elige la fecha en la que se debe publicar esta entrada de blog.
          </small>
        </div>
      </CardContent>
    </Card>
  );
};

export default PostDate;
