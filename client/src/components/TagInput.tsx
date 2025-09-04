import React, { useState } from 'react';
import { useController, type Control } from 'react-hook-form';

interface TagInputProps {
  control: Control<any>;
  name: string;
}

const TagInput: React.FC<TagInputProps> = ({ control, name }) => {
  const { field } = useController({ control, name });
  const [inputValue, setInputValue] = useState('');
  const tags = field.value || [];

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && inputValue.trim()) {
      event.preventDefault();
      const newTags = [...tags, inputValue.trim()];
      field.onChange(newTags);
      setInputValue('');
    }
  };

  const removeTag = (index: number) => {
    const newTags = [...tags];
    newTags.splice(index, 1);
    field.onChange(newTags);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag: string, index: number) => (
          <div key={index} className="flex items-center bg-gray-200 rounded-full px-3 py-1 text-sm font-medium text-gray-700">
            <span>{tag}</span>
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="ml-2 text-gray-500 hover:text-gray-700"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        placeholder="Add a tag and press Enter"
      />
    </div>
  );
};

export default TagInput;
