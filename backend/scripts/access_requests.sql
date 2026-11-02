-- Fase 3: solicitudes de acceso a diagramas.
-- Un usuario puede tener como máximo una solicitud PENDING por diagrama;
-- las solicitudes REJECTED/APPROVED no bloquean una nueva solicitud posterior.

CREATE TABLE IF NOT EXISTS auth.access_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  diagram_id varchar NOT NULL REFERENCES core.diagrams(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status varchar NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS access_requests_pending_unique
  ON auth.access_requests (diagram_id, requester_id)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS access_requests_diagram_status_idx
  ON auth.access_requests (diagram_id, status);

CREATE INDEX IF NOT EXISTS access_requests_requester_idx
  ON auth.access_requests (requester_id);
