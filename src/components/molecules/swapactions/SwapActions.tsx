import React from "react";
import Button from "../../atoms/button/Button";
import FileUpload from "../../atoms/fileupload/FileUpload";

interface SwapActionsProps {
  onSwap: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const SwapActions: React.FC<SwapActionsProps> = ({ onSwap, onFileUpload }) => {
  return (
    <div className="form-button-row">
      <Button
        label="🔁 Intercambiar"
        onClick={onSwap}
        className="action-button swap-button"
      />
      <FileUpload
        onChange={onFileUpload}
        label="📁 Importar CSV"
        id="csv-upload"
        className="action-button import-button"
      />
    </div>
  );
};

export default SwapActions;
