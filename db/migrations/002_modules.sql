-- Module versions and the two new module parts (routing, materials).
-- Modules are owned by GitHub (modules/ folder) and published into these tables on merge.
BEGIN;
ALTER TABLE components      ADD COLUMN IF NOT EXISTS version   text  NOT NULL DEFAULT '1.0.0';
ALTER TABLE components      ADD COLUMN IF NOT EXISTS routing   jsonb NOT NULL DEFAULT '[]';
ALTER TABLE components      ADD COLUMN IF NOT EXISTS materials jsonb NOT NULL DEFAULT '[]';
ALTER TABLE products        ADD COLUMN IF NOT EXISTS version   text  NOT NULL DEFAULT '1.0.0';
ALTER TABLE design_guide_rules ADD COLUMN IF NOT EXISTS version text NOT NULL DEFAULT '1.0.0';
ALTER TABLE detail_drawings ADD COLUMN IF NOT EXISTS version   text  NOT NULL DEFAULT '1.0.0';

CREATE TABLE IF NOT EXISTS departments (
  key        text PRIMARY KEY,
  name       text NOT NULL,
  notes      text,
  sort_order integer NOT NULL DEFAULT 0
);

-- Every published version of every module, so saved proofs can reopen with the version they were built with.
CREATE TABLE IF NOT EXISTS module_versions (
  kind         text NOT NULL CHECK (kind IN ('component','product','rule','drawing')),
  module_id    text NOT NULL,
  version      text NOT NULL,
  content      jsonb NOT NULL,
  git_sha      text,
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, module_id, version)
);
COMMIT;
