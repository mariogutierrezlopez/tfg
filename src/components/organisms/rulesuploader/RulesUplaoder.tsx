// src/components/RulesUploader.tsx
import React, { ChangeEvent } from 'react';
import decisionTree from '../utils/decisionTree';

interface Props {
  onLoad: (tree: decisionTree.TreeNode) => void;
}

export function RulesUploader({ onLoad }: Props) {
  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      onLoad(parsed);
    } catch (err) {
      console.error('JSON inválido en reglas:', err);
      alert('No se pudo parsear el JSON de reglas.');
    }
  };

  return (
    <div className="p-4">
      <label className="block mb-2 font-medium">
        Sube tu archivo de reglas (.json):
      </label>
      <input type="file" accept=".json" onChange={handleFile} />
    </div>
  );
}
