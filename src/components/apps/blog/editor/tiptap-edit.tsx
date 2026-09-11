
import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Link } from "@tiptap/extension-link";
import { Image } from "@tiptap/extension-image";
import { Underline } from "@tiptap/extension-underline";
import { OrderedList } from "@tiptap/extension-ordered-list";
import BulletList from "@tiptap/extension-bullet-list";
import ListItem from "@tiptap/extension-list-item";
import { Bold, Code, Italic, Link2, List, ListOrdered, Redo, Underline as UnderlineIcon, Undo, Image as ImageIcon, Video } from 'lucide-react';

import "./tiptap.css";

interface TiptapEditProps {
  content?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
}

const TiptapEdit = ({ content = "", onChange, placeholder = "Empieza a escribir..." }: TiptapEditProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link,
      Image,
      Underline,
      OrderedList,
      BulletList,
      ListItem,
    ],
    content: content || `<p>${placeholder}</p>`,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && content && editor.getHTML() !== content) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const handleBold = () => editor?.chain().focus().toggleBold().run();
  const handleItalic = () => editor?.chain().focus().toggleItalic().run();
  const handleUnderline = () => editor?.chain()?.focus()?.toggleUnderline()?.run();
  const handleH1 = () => editor?.chain().focus().toggleHeading({ level: 1 }).run();
  const handleH2 = () => editor?.chain().focus().toggleHeading({ level: 2 }).run();
  const handleH3 = () => editor?.chain().focus().toggleHeading({ level: 3 }).run();
  const handleList = () => editor?.chain().focus().toggleBulletList().run();
  const handleOrderedList = () => editor?.chain().focus().toggleOrderedList().run();
  const handleLink = () => {
    const url = prompt("Introduce una URL");
    if (url) {
      editor?.chain().focus().setLink({ href: url }).run();
    }
  };
  const handleImage = () => {
    const url = prompt("Introduce la URL de la imagen (o la URL de la miniatura de YouTube)");
    if (url) {
      editor?.chain().focus().setImage({ src: url }).run();
    }
  };
  const handleYoutube = () => {
    const url = prompt("Introduce la URL del vídeo de YouTube (p. ej., https://www.youtube.com/watch?v=...)");
    if (url) {
      let embedUrl = url;
      const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
      if (match) {
        embedUrl = `https://www.youtube.com/embed/${match[1]}`;
      }
      const iframe = `<iframe src="${embedUrl}" width="100%" height="400" frameborder="0" allowfullscreen style="margin: 16px 0; border-radius: 8px;"></iframe>`;
      editor?.chain().focus().insertContent(iframe).run();
    }
  };
  const handleCodeBlock = () => editor?.chain().focus().toggleCodeBlock().run();
  const handleUndo = () => editor?.chain().focus().undo().run();
  const handleRedo = () => editor?.chain().focus().redo().run();

  return (
    <div className="editor-container">
      <div className="toolbar flex gap-3 flex-wrap border-b pb-2 mb-2">
        <button onClick={handleBold} title="Negrita">
          <Bold className="text-lg font-semibold hover:text-primary dark:hover:text-primary" size={16} />
        </button>
        <button onClick={handleItalic} title="Cursiva">
          <Italic className="text-lg font-semibold hover:text-primary dark:hover:text-primary" size={16} />
        </button>
        <button onClick={handleUnderline} title="Subrayado">
          <UnderlineIcon className="text-lg font-semibold hover:text-primary dark:hover:text-primary" size={16} />
        </button>
        <button onClick={handleH1} title="Título 1">
          <span className="text-sm font-medium hover:text-primary dark:hover:text-primary">H1</span>
        </button>
        <button onClick={handleH2} title="Título 2">
          <span className="text-sm font-medium hover:text-primary dark:hover:text-primary">H2</span>
        </button>
        <button onClick={handleH3} title="Título 3">
          <span className="text-sm font-medium hover:text-primary dark:hover:text-primary">H3</span>
        </button>
        <button onClick={handleList} title="Lista con viñetas">
          <List className="text-lg font-semibold hover:text-primary dark:hover:text-primary" size={16} />
        </button>
        <button onClick={handleOrderedList} title="Lista numerada">
          <ListOrdered className="text-lg font-semibold hover:text-primary dark:hover:text-primary" size={16} />
        </button>
        <button onClick={handleLink} title="Insertar enlace">
          <Link2 className="text-lg font-semibold hover:text-primary dark:hover:text-primary" size={16} />
        </button>
        <button onClick={handleImage} title="Insertar imagen">
          <ImageIcon className="text-lg font-semibold hover:text-primary dark:hover:text-primary" size={16} />
        </button>
        <button onClick={handleYoutube} title="Insertar vídeo de YouTube">
          <Video className="text-lg font-semibold hover:text-primary dark:hover:text-primary" size={16} />
        </button>
        <button onClick={handleCodeBlock} title="Bloque de código">
          <Code className="text-lg font-semibold hover:text-primary dark:hover:text-primary" size={16} />
        </button>
        <button onClick={handleUndo} title="Deshacer">
          <Undo className="text-lg font-semibold hover:text-primary dark:hover:text-primary" size={16} />
        </button>
        <button onClick={handleRedo} title="Rehacer">
          <Redo className="text-lg font-semibold hover:text-primary dark:hover:text-primary" size={16} />
        </button>
      </div>
      <EditorContent editor={editor} style={{ minHeight: "200px" }} />
    </div>
  );
};

export default TiptapEdit;
