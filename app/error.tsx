'use client';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <h1>Something went wrong</h1>
      <div className="note bad">{/DATABASE_URL|ECONNREFUSED|ENOTFOUND|password authentication/i.test(error.message)
        ? 'The app cannot reach the database. Check DATABASE_URL in the hosting settings.' : 'The change was not saved. Try again, and if it keeps failing, note what you were editing.'}</div>
      <div><button className="primary" onClick={reset}>Try again</button></div>
    </div>
  );
}
