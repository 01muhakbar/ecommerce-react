import React, { useCallback, useState } from "react";

type Props = {
  accept?: string[];
  onFile: (file: File | null) => void;
  previewUrl?: string | null;
};

export default function ImageDropzone({ accept = [".jpeg",".jpg",".png",".webp"], onFile, previewUrl }: Props) {
  const [drag, setDrag] = useState(false);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file && accept.some(ext => file.name.toLowerCase().endsWith(ext))) onFile(file);
    else onFile(null);
  }, [accept, onFile]);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      className={`border-2 border-dashed rounded-xl p-6 text-center ${drag ? "border-emerald-500 bg-emerald-50" : "border-gray-300"}`}
    >
      {previewUrl ? (
        <img src={previewUrl} alt="preview" className="mx-auto h-32 w-32 object-cover rounded-full"/>
      ) : (
        <>
          <div className="text-emerald-600 text-2xl">☁️ ⤴</div>
          <p className="mt-2 font-medium">Drag your images here</p>
          <p className="text-sm text-gray-500">(Only *.jpeg, *.webp and *.png images will be accepted)</p>
          <label className="inline-block mt-3 px-3 py-2 rounded-lg bg-emerald-600 text-white cursor-pointer">
            Browse…
            <input type="file" accept={accept.join(",")} hidden onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          </label>
        </>
      )}
    </div>
  );
}
