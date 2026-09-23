'use client';

import { useState } from 'react';

type RelationshipType = 'ASSOCIATION' | 'INHERITANCE' | 'AGGREGATION' | 'COMPOSITION';

interface RelationTypeSelectorProps {
  value: 'ASSOCIATION' | 'INHERITANCE' | 'AGGREGATION' | 'COMPOSITION';
  onChange: (value: 'ASSOCIATION' | 'INHERITANCE' | 'AGGREGATION' | 'COMPOSITION') => void;
}

const relationshipTypes: { value: RelationshipType; label: string; symbol: React.ReactNode; description: string }[] = [
  {
    value: 'ASSOCIATION',
    label: 'Asociación',
    symbol: (
      <svg width="24" height="16" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="2" y1="8" x2="22" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M16 4 L20 8 L16 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
    description: 'Asociación normal (flecha simple)'
  },
  {
    value: 'INHERITANCE',
    label: 'Herencia',
    symbol: (
      <svg width="24" height="16" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="2" y1="8" x2="22" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4,2" />
        <polygon points="18,4 22,8 18,12" fill="white" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    description: 'Herencia (triángulo hueco, línea punteada)'
  },
  {
    value: 'AGGREGATION',
    label: 'Agregación',
    symbol: (
      <svg width="24" height="16" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="2" y1="8" x2="22" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <polygon points="16,4 20,8 16,12 12,8" fill="white" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    description: 'Agregación (rombo blanco hueco)'
  },
  {
    value: 'COMPOSITION',
    label: 'Composición',
    symbol: (
      <svg width="24" height="16" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="2" y1="8" x2="22" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <polygon points="16,4 20,8 16,12 12,8" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    description: 'Composición (rombo negro relleno)'
  },
];

export default function RelationTypeSelector({ value, onChange }: RelationTypeSelectorProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-300 p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold text-sm text-gray-700">Tipo de relación</span>
        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600 font-mono">
          {relationshipTypes.find(t => t.value === value)?.label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de relación">
        {relationshipTypes.map(({ value: typeValue, label, symbol, description }) => (
          <button
            key={typeValue}
            type="button"
            onClick={() => onChange(typeValue)}
            role="radio"
            aria-checked={value === typeValue}
            aria-label={label}
            title={description}
            className={`relative flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all duration-200 ${
              value === typeValue
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
            }`}
          >
            <div className="w-16 h-10 flex items-center justify-center mb-1">
              {symbol}
            </div>
            <span className="text-xs font-medium text-gray-700">{label}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-2 text-center">
        Selecciona el tipo antes de conectar dos entidades
      </p>
    </div>
  );
}