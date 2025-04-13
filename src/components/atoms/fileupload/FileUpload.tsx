import React from "react";

interface FileUploadProps {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label: string;
  id: string;
  className?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onChange,
  label,
  id,
  className = "",
}) => {
  return (
    <div className="file-upload-wrapper">
      <label htmlFor={id} className={`btn ${className}`}>
        {label}
      </label>
      <input type="file" id={id} onChange={onChange} accept=".csv" hidden />
    </div>
  );
};

export default FileUpload;
