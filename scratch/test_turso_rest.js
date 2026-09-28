import { execFileSync } from 'child_process';

const tursoUrl = (process.env.TURSO_DATABASE_URL || 'libsql://don-don-7309.aws-ap-northeast-1.turso.io')
  .replace(/^libsql:\/\//, 'https://')
  .replace(/\/$/, '') + '/v2/pipeline';

const authToken = process.env.TURSO_AUTH_TOKEN || '';

export function queryTurso(sql) {
  const payload = JSON.stringify({
    requests: [
      { type: 'execute', stmt: { sql } },
      { type: 'close' }
    ]
  });

  try {
    const output = execFileSync('curl', [
      '-s',
      '-X', 'POST',
      tursoUrl,
      '-H', 'Content-Type: application/json',
      '-H', `Authorization: Bearer ${authToken}`,
      '-d', payload
    ], { encoding: 'utf8' });

    const res = JSON.parse(output);
    const execRes = res.results?.[0]?.response?.result;
    if (!execRes) {
      if (res.results?.[0]?.error) {
        throw new Error(res.results[0].error.message);
      }
      if (res.error) {
        throw new Error(res.error);
      }
      return [];
    }

    const cols = execRes.cols.map(c => c.name);
    return execRes.rows.map(row => {
      const obj = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx]?.value ?? null;
      });
      return obj;
    });
  } catch (err) {
    console.error("Turso Query Error:", err.message);
    throw err;
  }
}

console.log("Turso pipeline helper created.");
