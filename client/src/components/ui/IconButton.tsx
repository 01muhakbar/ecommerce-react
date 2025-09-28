import React from "react";
type Props = React.ButtonHTMLAttributes<HTMLButtonElement>;
export default function IconButton({ className="", ...rest }: Props) {
  return <button {...rest} className={`p-2 rounded hover:bg-gray-100 border border-transparent hover:border-gray-200 ${className}`} />;
}