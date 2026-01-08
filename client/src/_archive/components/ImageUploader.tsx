import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useController, type Control } from 'react-hook-form';

interface ImageUploaderProps {
  control: Control<any>;
  name: string;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ control, name }) => {
  const { field } = useController({ control, name });
  const [preview, setPreview] = useState<string[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    field.onChange(acceptedFiles);
    const previewUrls = acceptedFiles.map(file => URL.createObjectURL(file));
    setPreview(previewUrls);
  }, [field]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] } });

  const removeImage = (index: number) => {
    const updatedFiles = [...(field.value || [])];
    updatedFiles.splice(index, 1);
    field.onChange(updatedFiles);

    const updatedPreviews = [...preview];
    updatedPreviews.splice(index, 1);
    setPreview(updatedPreviews);
  };

  return (
    <div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer ${
          isDragActive ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300'
        }`}
      >
        <input {...getInputProps()} />
        {
          isDragActive ?
            <p>Drop the files here ...</p> :
            <p>Drag 'n' drop some files here, or click to select files</p>
        }
      </div>
      <div className="mt-4 flex flex-wrap gap-4">
        {preview.map((url, index) => (
          <div key={index} className="relative">
            <img src={url} alt={`Preview ${index}`} className="h-24 w-24 object-cover rounded-md" />
            <button
              type="button"
              onClick={() => removeImage(index)}
              className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 text-xs"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImageUploader;