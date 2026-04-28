// Inline edit primitives used inside the storefront.
// When `editing=true`, text becomes contentEditable and images get an upload overlay.
// Click anywhere → edit in place.

import { useEffect, useRef, type ReactNode } from "react";
import { ImagePlus, Pencil } from "lucide-react";

type EditableTextProps = {
  editing: boolean;
  value: string;
  onChange: (v: string) => void;
  as?: "h1" | "h2" | "h3" | "p" | "span" | "div";
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  style?: React.CSSProperties;
};

export function EditableText({
  editing,
  value,
  onChange,
  as: Tag = "p",
  className = "",
  placeholder = "Clique para editar",
  multiline = false,
  style,
}: EditableTextProps) {
  const ref = useRef<HTMLElement | null>(null);

  // Keep DOM in sync with external value updates without disturbing the cursor while typing.
  useEffect(() => {
    if (!ref.current) return;
    if (ref.current.innerText !== (value || "")) {
      ref.current.innerText = value || "";
    }
  }, [value]);

  if (!editing) {
    return (
      <Tag className={className} style={style}>
        {value || placeholder}
      </Tag>
    );
  }

  return (
    <Tag
      ref={ref as any}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onBlur={(e) => onChange((e.target as HTMLElement).innerText.trim())}
      onKeyDown={(e) => {
        if (!multiline && e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
      }}
      className={`${className} inline-edit-target rounded-md outline-none transition-all hover:ring-2 hover:ring-rose/40 focus:ring-2 focus:ring-mauve px-1 -mx-1`}
      style={style}
    >
      {value}
    </Tag>
  );
}

type EditableImageProps = {
  editing: boolean;
  src: string | null;
  alt: string;
  className?: string;
  onUpload: (file: File) => Promise<void> | void;
  fallback?: ReactNode;
  aspect?: string; // tailwind aspect class
};

export function EditableImage({
  editing,
  src,
  alt,
  className = "",
  onUpload,
  fallback,
  aspect,
}: EditableImageProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const inner = src ? (
    <img src={src} alt={alt} className={`h-full w-full object-cover ${className}`} />
  ) : (
    <div className={`grid h-full w-full place-items-center bg-blush/40 ${className}`}>
      {fallback ?? <ImagePlus className="h-8 w-8 text-mauve/40" />}
    </div>
  );

  if (!editing) {
    return <div className={`relative overflow-hidden ${aspect ?? ""}`}>{inner}</div>;
  }

  return (
    <div
      className={`group relative overflow-hidden ring-2 ring-transparent hover:ring-rose/60 transition cursor-pointer ${aspect ?? ""}`}
      onClick={() => inputRef.current?.click()}
    >
      {inner}
      <div className="absolute inset-0 grid place-items-center bg-mauve/0 group-hover:bg-mauve/40 transition">
        <span className="opacity-0 group-hover:opacity-100 transition rounded-full bg-cream px-3 py-1.5 text-xs font-medium text-mauve inline-flex items-center gap-1.5">
          <ImagePlus className="h-3.5 w-3.5" /> Trocar imagem
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}

export function EditableHint({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-rose/80">
      <Pencil className="h-2.5 w-2.5" /> {children}
    </span>
  );
}
