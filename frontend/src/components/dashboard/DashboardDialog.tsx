'use client';

import { DS } from '../../styles/design-system';
import { AccessRole, DialogState } from '../../types/dashboard';

interface DashboardDialogProps {
  dialog: DialogState;
  name: string;
  role: AccessRole;
  error: string;
  busy: boolean;
  onNameChange: (value: string) => void;
  onRoleChange: (role: AccessRole) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}

export default function DashboardDialog({
  dialog,
  name,
  role,
  error,
  busy,
  onNameChange,
  onRoleChange,
  onClose,
  onSubmit,
}: DashboardDialogProps) {
  if (!dialog) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dashboard-dialog-title"
    >
      <form
        onSubmit={onSubmit}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-200 p-6"
      >
        <h2 id="dashboard-dialog-title" className="text-lg font-semibold text-gray-900 mb-2">
          {dialog.mode === 'create'
            ? 'Nuevo diagrama'
            : dialog.mode === 'rename'
            ? 'Renombrar diagrama'
            : dialog.mode === 'delete'
            ? 'Eliminar diagrama'
            : 'Aprobar solicitud'}
        </h2>

        {dialog.mode === 'delete' ? (
          <p className="text-sm text-gray-600 mb-4">
            ¿Estás seguro de que quieres eliminar “{dialog.diagram.name}”? Se eliminarán
            el diagrama, su ACL y su snapshot. Esta acción no se puede deshacer.
          </p>
        ) : dialog.mode === 'approve' ? (
          <div className="mb-4 space-y-3">
            <p className="text-sm text-gray-600">
              {dialog.request.requesterUsername} solicita acceso a{' '}
              <span className="font-medium text-gray-800">{dialog.request.diagramName}</span>.
            </p>
            <div>
              <label htmlFor="access-request-role" className="block text-sm font-medium text-gray-700 mb-1">
                Rol a conceder
              </label>
              <select
                id="access-request-role"
                value={role}
                onChange={(event) => onRoleChange(event.target.value as AccessRole)}
                className={`w-full ${DS.input.base}`}
              >
                <option value="VIEWER">Lector (solo lectura)</option>
                <option value="EDITOR">Editor (puede modificar)</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <label htmlFor="dashboard-diagram-name" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del diagrama
            </label>
            <input
              id="dashboard-diagram-name"
              autoFocus
              type="text"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              maxLength={120}
              className={`w-full ${DS.input.base}`}
              placeholder="Ej. Sistema de pedidos"
            />
          </div>
        )}

        {error && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`${DS.button.base} ${DS.button.ghost}`}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy}
            className={`${DS.button.base} ${
              dialog.mode === 'delete' ? DS.button.danger : DS.button.primary
            }`}
          >
            {busy
              ? 'Procesando...'
              : dialog.mode === 'create'
              ? 'Crear'
              : dialog.mode === 'rename'
              ? 'Guardar'
              : dialog.mode === 'delete'
              ? 'Eliminar'
              : 'Aprobar'}
          </button>
        </div>
      </form>
    </div>
  );
}
