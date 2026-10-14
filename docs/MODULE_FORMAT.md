# SignCore module format (draft v1)

**Status: draft for team review.** It describes how SignCore defines products and components as files in this repository. Everything here can change in review.

## Why modules are files

A module is the definition of one product or component: its fields, options, defaults, Show If rules, calculations, and the drawings and design rules that go with it. Keeping modules as files in GitHub gives three things:

- **Every change is reviewed.** It goes through a pull request, the checks below run, and someone approves it.
- **Every change is versioned.** Each module carries a version, and SignCore keeps every published version, so a proof saved months ago still opens with the definition it was built on.
- **History and rollback come free.** Git shows who changed what and why, and a bad change is reverted like any other commit.

When a pull request merges, `npm run modules:publish` copies the modules into the SignCore database. The tools read them from SignCore's API. The database is a published copy; **the files are the source**.

The Spec Manager screens stay the friendly way to edit. In the next step their Save button will open a pull request that changes these files, instead of writing to the database.

### What is *not* a module

These stay in SignCore's database, edited in admin screens or refreshed from supplier files:

- color libraries (Oracal, Sherwin-Williams, PMS, Rowmark, coil, trim cap, LED, substrates)
- the SignOS reference
- ADA pictograms
- the proof template text
- (later) pricing, materials stock, labor rates and inventory

## Folder layout

```
modules/
  components/
    CHANNEL_LETTERS_FL/
      component.yaml          fields, routing, materials
    CABINET/
      component.yaml
    …                         one folder per component (26 today)
  products/
    channel-letters-front-lit.yaml    sections in proof order
    …                         one file per product (19 today)
  library/
    departments.yaml          work order departments (draft)
    design-guide/
      K06.yaml                one file per Design Guide rule (87 today)
    drawings/
      MNT_RACEWAY.yaml        drawing settings
      MNT_RACEWAY.svg         the drawing itself; GitHub shows it as a picture in pull requests
schemas/                      JSON Schemas; editors such as VS Code use them for autocomplete and error underlines
```

Component folders are named by the component ID, which never changes casually: products, rules, drawings and saved proofs all refer to it.

**Why rules and drawings live in a shared library, not inside component folders.** Most of them apply to several components. For example, `LTR_FRONT_LIT` serves channel letters, monument letters and front lit cloud signs, and many rules apply to every proof. Each rule or drawing is one file that declares what it applies to, and the Spec Manager shows each component which rules and drawings reach it.

## Component file

Worked example: `modules/components/CHANNEL_LETTERS_FL/component.yaml` (shortened).

```yaml
schema: signcore.component/v1
id: CHANNEL_LETTERS_FL
name: Channel Letters - Front Lit
version: 1.0.0
order: 220
description: Front lit channel letters, one line of copy per block.
show_as_tool: false
repeatable: true
fields:
  - variable: QUANTITY
    label: QTY
    column: 1
    type: autoqty
    default: "1"
    options: [LETTER HEIGHT]
    required: true
  - variable: FACE VINYL
    label: VINYL
    column: 2
    type: select
    default: None
    options: [None, Translucent Vinyl, Translucent Digital Print]
    required: true
    hide_values: [None]
  - variable: VINYL COLOR
    column: 2
    type: vinyl
    default: "8500"
    options: ["8500", "8800"]
    show_if: FACE VINYL=Translucent Vinyl
    required: true
    signos: "Master_Mat_Vinyl_Cut: VIN_ROL_TRN_8500 / 8800"
routing:                       # new, draft
  - department: vinyl
    when: FACE VINYL=Translucent Vinyl
    work: Cut and apply Oracal {VINYL COLOR} translucent vinyl to the faces
materials:                     # new, draft
  - item: Translucent face vinyl
    signos: VIN_ROL_TRN_8500
    when: FACE VINYL=Translucent Vinyl
    qty: TBD
    unit: SqFt
```

| Key | Meaning |
| --- | --- |
| `id` | Stable ID, capitals and underscores. Must match the folder name. |
| `name` | Display name. |
| `version` | `major.minor.patch`. See Versioning. |
| `order` | Position in component lists. |
| `show_as_tool`, `repeatable` | Same meaning as in today's Component_Registry. |
| `fields` | In proof order. Each field's `column` is its preview column. |
| `routing` | *Draft.* Which departments get work, and what they do. |
| `materials` | *Draft.* Materials list lines. |

**Field keys.**

| Key | Meaning |
| --- | --- |
| `variable` | Name used everywhere else (Show If, calcs, product defaults, rules, drawings). Cannot contain `= & \| ; { }`. |
| `label` | Text printed on the proof; omitted when it equals the variable. |
| `column` | Preview column, 1 to 5. |
| `type` | `select`, `text`, `number`, `dims`, `calc`, `paint`, `finish`, `vinyl`, `db`, `color`, `fullcolor`, `rowmark`, `pictogram`, `autoqty`. The meanings are unchanged from today; see the schema descriptions. |
| `default` | The starting value. Dimensions use `96\|36\|8`. |
| `options` | A YAML list (no more pipes). For `calc` fields, each item is a `LABEL=EXPR` term. For `db` fields, it's the color tab. For `number` fields, it's the unit. |
| `show_if` | Shown only when the condition holds: `VAR=a\|b` (equals one of), `VAR!=a\|b` (equals none of), `VAR~=text` (contains). Join conditions with `&`. |
| `required` | Blank prints a yellow MISSING tag. |
| `hide_values` | Values that are left off the proof, e.g. `None`. |
| `signos`, `notes` | Reference text. |

## Product file

```yaml
schema: signcore.product/v1
name: Lighted Cabinets
version: 1.0.0
order: 20
sections:
  - component: CABINET
    title: Cabinet
    include: required            # required | optional-on | optional-off
    page_group: 1
    defaults:                    # this product's defaults for the component
      MOUNTING: Wall Mount
  - component: POLY_FACE
    title: Face
    page_group: 1
```

`legacy_fields` holds the old Product_Schema rows for the 10 products that had them. They're kept so nothing is lost, and can be dropped once nothing uses them.

## Design Guide rule and detail drawing

```yaml
schema: signcore.rule/v1
id: K06
version: 1.0.0
section: CABINETS AND FACES
order: 725
basis: House                     # House | SignOS | Industry
applies_to:
  components: []                 # blank = any component
  when: COPY TYPE=Push-Thru Acrylic OR MOUNTING=Push-Thru OR ROUTING=Push-Thru
standard: 'Push-thru edge clearance: all push-thru copy and graphics stay a minimum of 2.25" from every edge of the face. …'
why: …
how_to: …
```

A drawing file has the same `applies_to`, plus `title`, `category`, `order` and `notes`. Its picture sits next to it as a normal SVG file on a 100 × 100 grid.

## Versioning

- **Patch** (1.0.0 → 1.0.1): wording, notes, labels or the order of options. Saved proofs are not affected.
- **Minor** (→ 1.1.0): something is added, such as a field, an option or a routing step. Old proofs still open; the new field is blank.
- **Major** (→ 2.0.0): something is removed or renamed, such as a field, an option value or a variable name. Old proofs that used it need the old version. SignCore keeps every version, so they still open.

Publishing refuses a module whose content changed but whose version did not.

## Checks

| Command | What it does |
| --- | --- |
| `npm run modules:check` | Checks every file against its schema. Then it cross-checks: Show If, calcs, routing and materials must name real fields; product defaults must name fields of that component; rules and drawings must name real components; a select's default must be one of its options; no duplicate IDs; drawings contain no scripts. |
| `npm run modules:roundtrip` | Publishes into a database inside a transaction, reads everything back, compares, then rolls back. It also confirms the checker catches deliberate mistakes. |
| `npm run modules:publish` | Copies the files into a SignCore database and records each module version. |
| `npm run modules:export` | One time only: wrote these files from today's database. |

All of these run on every pull request (`.github/workflows/ci.yml`).

## Open questions for review

1. **File format.** YAML (proposed: readable, comments allowed, clean diffs) or JSON or TypeScript.
2. **Shared library.** Rules and drawings in a shared library with `applies_to` (proposed), or inside component folders.
3. **Show If syntax.** Keep today's text syntax (proposed for v1, since the proof engine already reads it), or move to structured conditions later.
4. **Routing.** Is one entry per department enough? Do steps need an order, time estimates, or a link to SignOS labor items?
5. **Materials.** Where do quantities come from? Many need letter outlines or areas from the proof (for example, return coil per letter perimeter). Should SignStudio compute them, or should modules carry formulas?
6. **Departments.** Is `library/departments.yaml` the right list and the right keys?
7. **Product IDs.** Products are keyed by name today. Add a stable `id`, as components have, before saved proofs reference them?
8. **Legacy fields.** Drop `legacy_fields` and the retired Product_Schema stubs once nothing uses them?
9. **Who approves module pull requests,** and is one review enough for patch changes?
