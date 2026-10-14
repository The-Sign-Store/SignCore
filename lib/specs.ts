// SignCore spec conventions, taken from the README tab of the Google Sheet.

export const FIELD_TYPES: { value: string; label: string; help: string; options?: string; default?: string }[] = [
  { value: 'select', label: 'Dropdown', help: "Dropdown from Options. SignCore adds a '-- Custom Input --' choice automatically.", options: 'One choice per line' },
  { value: 'text', label: 'Text', help: 'Free entry.' },
  { value: 'number', label: 'Number', help: 'Free entry. Options = a unit shown after the value on the proof.', options: 'Unit, e.g. "  (inches)' },
  { value: 'dims', label: 'Dimensions', help: 'Dimension boxes. Proof shows 96"W x 36"H x 8"D.', options: 'Box labels, one per line (W, H, D)', default: 'Values separated by | (96|36|8)' },
  { value: 'calc', label: 'Calculated', help: 'Read-only, calculated from other fields in this component (inches). Only + - * / ( ) and numbers. Do not start with =.', options: 'LABEL=EXPR per line, e.g. W={MODULES WIDE}*9.45, or one bare expression {A}+{B}' },
  { value: 'paint', label: 'Paint color', help: 'Sherwin-Williams / PMS / Custom swatch picker.' },
  { value: 'finish', label: 'Finish', help: "Standard finishes from Finish_Colors, plus 'Custom Paint' (SW / PMS picker).", options: 'Finishes to offer, one per line' },
  { value: 'vinyl', label: 'Vinyl', help: 'Oracal series dropdown plus swatch picker from Oracal_Colors.', options: 'Allowed series, one per line (951, 751RA, 651)' },
  { value: 'db', label: 'Color tab swatch', help: 'Swatch picker from a color tab.', options: 'One of LED, COIL, TRIMCAP, ACM, ACRYLIC, PVC, CORO' },
  { value: 'color', label: 'Color list', help: 'Color chosen from Options.', options: 'Colors, one per line' },
  { value: 'fullcolor', label: 'Full color print', help: 'Full color digital print callout.' },
  { value: 'rowmark', label: 'Rowmark swatch', help: 'Rowmark swatch picker.', options: 'Series to show, one per line' },
  { value: 'pictogram', label: 'ADA pictogram', help: 'ADA pictogram picker from ADA_Pictograms.' },
  { value: 'autoqty', label: 'Letter count', help: "Letter count calculated from the TEXT field.", options: "The letter-height variable merged into 'QTY / HEIGHT'" },
];
export const TYPE_MAP = Object.fromEntries(FIELD_TYPES.map((t) => [t.value, t]));

export const ZONES = ['COLUMN 1', 'COLUMN 2', 'COLUMN 3', 'COLUMN 4', 'COLUMN 5'];
export const INCLUDE = ['Required', 'Optional-On', 'Optional-Off'] as const;
export const BASIS = ['House', 'SignOS', 'Industry'] as const;

export const HELP = {
  showIf: 'Hide this field unless a condition is met (same component).  VAR=a|b  equals one of · VAR!=a|b  not · VAR~=text  contains. Join with &.',
  overrides: 'Change this component\'s defaults for this product only:  VAR=value; VAR=value  (dims use |, e.g. CABINET SIZE=120|48|12).',
  pageGroup: 'Sections with the same number share a proof page (max 2 per page).',
  include: 'Required always shows. Optional-On / Optional-Off is a checkbox in SignCore that starts ticked or unticked.',
  matchRule: "Spec condition that turns this on, e.g. COPY TYPE=Push-Thru Acrylic OR MOUNTING=Push-Thru. Uses the same VAR=, VAR~= syntax; join with OR.",
};

/** Options are stored pipe-separated; the editor shows one per line. */
export const optionsToLines = (s: string | null | undefined) => (s ? s.split('|').join('\n') : '');
export const linesToOptions = (s: string) => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).join('|') || null;

export const clean = (v: FormDataEntryValue | null) => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s === '' ? null : s;
};

/** Variables named in a Show_If expression. */
export function showIfVariables(expr: string | null): string[] {
  if (!expr) return [];
  return expr.split('&').map((c) => c.trim().match(/^(.+?)\s*(!=|~=|=)/)?.[1].trim()).filter((x): x is string => !!x);
}
/** Variables named in a Default_Overrides string. */
export function overrideVariables(expr: string | null): string[] {
  if (!expr) return [];
  return expr.split(';').map((p) => p.split('=')[0]?.trim()).filter(Boolean);
}
/** {VAR} tokens in a calc expression. */
export function calcVariables(expr: string | null): string[] {
  return expr ? [...expr.matchAll(/\{([^}]+)\}/g)].map((m) => m[1].trim()) : [];
}

/** Rename a variable inside Show_If, Default_Overrides and calc expressions. */
export function renameInShowIf(expr: string | null, from: string, to: string) {
  if (!expr) return expr;
  return expr.split('&').map((c) => {
    const m = c.match(/^(\s*)(.+?)(\s*)(!=|~=|=)([\s\S]*)$/);
    return m && m[2].trim() === from ? `${m[1]}${to}${m[3]}${m[4]}${m[5]}` : c;
  }).join('&');
}
export function renameInOverrides(expr: string | null, from: string, to: string) {
  if (!expr) return expr;
  return expr.split(';').map((p) => {
    const i = p.indexOf('=');
    if (i < 0) return p;
    const name = p.slice(0, i);
    return name.trim() === from ? p.replace(name.trim(), to) : p;
  }).join(';');
}
export function renameInCalc(expr: string | null, from: string, to: string) {
  if (!expr) return expr;
  return expr.replace(/\{([^}]+)\}/g, (all, v) => (v.trim() === from ? `{${to}}` : all));
}

export type Result = { ok: boolean; message?: string; warnings?: string[]; at?: number };
export const ok = (message: string, warnings?: string[]): Result => ({ ok: true, message, warnings, at: Date.now() });
export const fail = (message: string): Result => ({ ok: false, message, at: Date.now() });

/** Strip scripts and event handlers before previewing SVG markup. */
export function safeSvg(markup: string | null) {
  return (markup || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '');
}
