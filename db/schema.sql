-- SignCore Spec Manager: Postgres schema (Neon-ready, Postgres 15+)
-- Run once on an empty database, then run seed.sql.

BEGIN;

-- ---------- Components ----------
CREATE TABLE components (
  component_id  text PRIMARY KEY CHECK (component_id ~ '^[A-Z0-9_]+$'),
  display_name  text NOT NULL,
  show_as_tool  boolean NOT NULL DEFAULT false,
  repeatable    boolean NOT NULL DEFAULT false,
  description   text,
  sort_order    integer NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE component_fields (
  id            serial PRIMARY KEY,
  component_id  text NOT NULL REFERENCES components(component_id) ON UPDATE CASCADE ON DELETE CASCADE,
  variable      text NOT NULL,
  sort_order    integer NOT NULL,
  zone          text,
  label         text,
  field_type    text NOT NULL DEFAULT 'text',
  default_value text,
  options       text,            -- pipe-separated, as SignCore reads it
  show_if       text,
  required      boolean NOT NULL DEFAULT false,
  signos_ref    text,
  notes         text,
  hide_values   text,
  UNIQUE (component_id, variable)
);
CREATE INDEX component_fields_order ON component_fields (component_id, sort_order);

-- ---------- Products ----------
CREATE TABLE products (
  product_name text PRIMARY KEY,
  sort_order   integer NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_components (          -- sheet: Product_Assembly
  id                serial PRIMARY KEY,
  product_name      text NOT NULL REFERENCES products(product_name) ON UPDATE CASCADE ON DELETE CASCADE,
  sort_order        integer NOT NULL,
  component_id      text NOT NULL REFERENCES components(component_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  section_title     text,
  include           text NOT NULL DEFAULT 'Required' CHECK (include IN ('Required','Optional-On','Optional-Off')),
  repeatable        boolean NOT NULL DEFAULT false,
  default_overrides text,
  page_group        integer
);
CREATE INDEX product_components_order ON product_components (product_name, sort_order);

CREATE TABLE product_fields (              -- sheet: Product_Schema (legacy per-product fields)
  id            serial PRIMARY KEY,
  product_name  text NOT NULL REFERENCES products(product_name) ON UPDATE CASCADE ON DELETE CASCADE,
  variable      text NOT NULL,
  sort_order    integer NOT NULL,
  zone          text,
  default_value text,
  options       text,
  UNIQUE (product_name, variable)
);

CREATE TABLE retired_product_fields (      -- sheet: Retired_Schema_Stubs
  id            serial PRIMARY KEY,
  product_name  text NOT NULL,
  zone          text,
  variable      text NOT NULL,
  default_value text,
  options       text
);

-- ---------- Detail drawings ----------
CREATE TABLE detail_drawings (
  drawing_id  text PRIMARY KEY,
  category    text,
  title       text,
  match_rule  text,
  sort_order  integer,
  active      boolean NOT NULL DEFAULT true,
  svg_markup  text,
  notes       text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE detail_drawing_components (
  drawing_id   text NOT NULL REFERENCES detail_drawings(drawing_id) ON UPDATE CASCADE ON DELETE CASCADE,
  component_id text NOT NULL REFERENCES components(component_id) ON UPDATE CASCADE ON DELETE CASCADE,
  position     integer NOT NULL DEFAULT 0,
  PRIMARY KEY (drawing_id, component_id)
);

-- ---------- Design Guide ----------
CREATE TABLE design_guide_sections (
  section_name text PRIMARY KEY,
  sort_order   integer NOT NULL
);

CREATE TABLE design_guide_rules (
  rule_id          text PRIMARY KEY,
  section_name     text NOT NULL REFERENCES design_guide_sections(section_name) ON UPDATE CASCADE,
  match_rule       text,
  standard         text NOT NULL,
  why              text,
  coreldraw_how_to text,
  basis            text NOT NULL DEFAULT 'House' CHECK (basis IN ('House','SignOS','Industry')),
  sort_order       integer NOT NULL,
  active           boolean NOT NULL DEFAULT true,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE design_guide_rule_components (
  rule_id      text NOT NULL REFERENCES design_guide_rules(rule_id) ON UPDATE CASCADE ON DELETE CASCADE,
  component_id text NOT NULL REFERENCES components(component_id) ON UPDATE CASCADE ON DELETE CASCADE,
  position     integer NOT NULL DEFAULT 0,
  PRIMARY KEY (rule_id, component_id)
);

-- ---------- Colors, materials and reference (read by SignCore, not edited in the app yet) ----------
CREATE TABLE sw_colors (color_code text PRIMARY KEY, brand text NOT NULL, color_name text NOT NULL, hex text, rgb text, r int, g int, b int);
CREATE TABLE pms_colors (pms_name text PRIMARY KEY, hex text, rgb text, r int, g int, b int);
CREATE TABLE oracal_colors (series_id text, color_code text, display_name text, finish text, hex text, vinyl_type text, PRIMARY KEY (series_id, color_code));
CREATE TABLE rowmark_colors (color_code text PRIMARY KEY, series text, display_name text, hex text, thickness text, cap_color text, core_color text);
CREATE TABLE material_colors (id serial PRIMARY KEY, palette text NOT NULL, component_type text, color_name text NOT NULL, hex text, sort_order int NOT NULL, UNIQUE (palette, color_name));
CREATE TABLE quick_colors (id serial PRIMARY KEY, type text NOT NULL, name text NOT NULL, hex text);
CREATE TABLE materials (id serial PRIMARY KEY, category text NOT NULL, material_name text NOT NULL);
CREATE TABLE ada_pictograms (item_code text PRIMARY KEY, category text, name text, viewbox text, svg_path text, is_active boolean NOT NULL, notes text);
CREATE TABLE signos_reference (signos_tab text, sku text, description text, uom text, PRIMARY KEY (signos_tab, sku));
CREATE TABLE proof_template (key text PRIMARY KEY, value text);
CREATE TABLE readme (line_no int PRIMARY KEY, section text, item text NOT NULL, description text);
CREATE TABLE meta (key text PRIMARY KEY, value text);

-- ---------- Change history ----------
CREATE TABLE change_log (
  id         bigserial PRIMARY KEY,
  changed_at timestamptz NOT NULL DEFAULT now(),
  actor      text,
  entity     text NOT NULL,      -- component, field, product, assembly, rule, drawing
  entity_id  text NOT NULL,
  action     text NOT NULL,      -- create, update, delete, reorder, rename
  summary    text,
  before     jsonb,
  after      jsonb
);
CREATE INDEX change_log_recent ON change_log (changed_at DESC);
CREATE INDEX change_log_entity ON change_log (entity, entity_id);

COMMIT;
