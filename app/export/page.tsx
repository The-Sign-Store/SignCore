import { withDb } from '@/lib/db';
import { SHEET_EXPORTS } from '@/lib/exports';

export const dynamic = 'force-dynamic';

export default async function ExportPage() {
  const last = await withDb((db) => db.one(`SELECT changed_at, actor, summary FROM change_log WHERE actor <> 'import' ORDER BY changed_at DESC LIMIT 1`));
  return (
    <div className="stack" style={{ maxWidth: 860 }}>
      <div className="head"><div><h1>Export</h1>
        <p className="sub">The database here is the master copy. SignCore still reads the Google Sheet, so after editing, export the changed tabs and replace them in the Sheet.</p></div></div>
      {last && <div className="note warn">Last edit: {last.summary} by {last.actor}, {new Date(last.changed_at).toLocaleString('en-US', { timeZone: 'America/New_York' })}.</div>}
      <div className="card flat"><div className="hd"><h2>Google Sheet tabs (CSV)</h2></div><div className="bd tbl-wrap">
        <table><tbody>{Object.entries(SHEET_EXPORTS).map(([key, s]) => (
          <tr key={key}><td><b>{s.tab}</b><div className="small muted">{s.headers.length} columns, same headers as the Sheet</div></td>
            <td style={{ textAlign: 'right' }}><a className="btn" href={`/export/${key}.csv`}>Download CSV</a></td></tr>))}</tbody></table>
      </div></div>
      <div className="card"><div className="hd"><h2>Update the Google Sheet</h2></div><div className="bd small">
        <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
          <li>Download the CSV for each tab you changed.</li>
          <li>In the Sheet, open that tab, then <b>File › Import › Upload</b> and choose the CSV.</li>
          <li>Pick <b>Replace current sheet</b>, and set “Convert text to numbers, dates, and formulas” to <b>No</b>, so values like 1/2" and 96|36|8 stay as written.</li>
          <li>Keep the tab name unchanged. SignCore's Code.gs reads tabs and headers by name.</li>
        </ol>
      </div></div>
      <div className="card"><div className="hd"><h2>Full backup (SQL)</h2><a className="btn primary" href="/export/backup.sql">Download backup</a></div><div className="bd small muted">
        Every table, including colors, SignOS reference and change history. Restores into a fresh database set up with db/schema.sql. Neon also keeps its own point-in-time history.
      </div></div>
    </div>
  );
}
