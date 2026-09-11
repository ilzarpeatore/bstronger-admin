
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";

interface MediaProps {
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
}

const Media = ({ imageFile, setImageFile }: MediaProps) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        setImageFile(acceptedFiles[0]);
      }
    },
    [setImageFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpeg", ".jpg", ".png", ".webp"] },
    maxFiles: 1,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h5>Imagen de portada</h5>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragActive ? "border-primary bg-primary/5" : "border-muted"
          }`}
        >
          <input {...getInputProps()} />
          {imageFile ? (
            <div className="flex flex-col items-center gap-2">
              <img
                src={URL.createObjectURL(imageFile)}
                alt="Vista previa"
                className="max-h-40 rounded"
              />
              <p className="text-sm text-muted-foreground">{imageFile.name}</p>
              <p className="text-xs text-destructive">Haz clic para reemplazar</p>
            </div>
          ) : isDragActive ? (
            <p className="text-primary">Suelta la imagen aquí...</p>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <p className="text-muted-foreground">Arrastra y suelta una imagen aquí, o haz clic para seleccionar</p>
              <p className="text-xs text-muted-foreground">Admite JPG, PNG, WebP</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default Media;
