
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import React from "react";

const CategoryTags = () => {
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>("");
  const [showTagOptions, setShowTagOptions] = useState<boolean>(false);

  const tagOptions = ["Tendencias", "Consejos", "Noticias", "Guía", "Popular", "Fitness", "Salud", "Bienestar"];

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleTagClick = (option: string) => {
    if (!tags.includes(option)) {
      setTags([...tags, option]);
    }
    setShowTagOptions(false);
  };

  const handleTagDelete = (tagToDelete: string) => {
    setTags(tags.filter((tag) => tag !== tagToDelete));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h5>Etiquetas</h5>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <div className="mb-2 block">
            <Label htmlFor="tags">Etiquetas</Label>
          </div>
          <div className="relative">
            <div className="flex flex-wrap items-center gap-1 min-h-[40px] w-full rounded-md border border-input bg-background px-2 py-1 focus-within:ring-1 focus-within:ring-primary">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className="py-1 px-2 rounded-full text-primary bg-primary/5 flex items-center"
                >
                  {tag}
                  <X onClick={() => handleTagDelete(tag)} className="cursor-pointer ml-1" size={12} />
                </span>
              ))}
              <input
                type="text"
                className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onFocus={() => setShowTagOptions(true)}
                onKeyDown={handleTagInputKeyDown}
                placeholder="Escribe y pulsa Enter..."
              />
            </div>
            <small className="text-xs text-muted-foreground">Añade etiquetas para el blog.</small>
            {showTagOptions && (
              <div className="absolute z-10 mt-1 w-full rounded-md bg-card shadow-lg max-h-40 overflow-y-auto">
                {tagOptions.map((option, index) => (
                  <div
                    key={index}
                    className={`cursor-pointer px-3 py-2 hover:bg-muted ${tags.includes(option) ? "opacity-50" : ""}`}
                    onClick={() => handleTagClick(option)}
                  >
                    {option}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CategoryTags;
