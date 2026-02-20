import { renderToStaticMarkup } from 'react-dom/server';
import type { LeaderboardEntry } from './types';

interface LeaderboardPageProps {
  entries: LeaderboardEntry[];
}

const PAGE_STYLES = `
  :root { --bg:#0c0c0c; --surface:#151515; --line:#2b2b2b; --text:#f2f2f2; --muted:#aaaaaa; --red:#cc4141; }
  * { box-sizing:border-box; }
  body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font-family:Inter, 'Helvetica Neue', Arial, sans-serif; }
  main { max-width:760px; margin:0 auto; padding:24px 16px 42px; }
  h1 { margin:0 0 8px; font-size:1.8rem; }
  p { margin:0 0 16px; color:var(--muted); }
  a { color:var(--text); text-decoration:none; border:1px solid var(--line); padding:8px 10px; display:inline-block; margin-bottom:14px; }
  table { width:100%; border-collapse:collapse; background:var(--surface); border:1px solid var(--line); }
  th, td { padding:10px 12px; border:1px solid var(--line); text-align:left; }
  th { color:#fff; background:#1d1d1d; }
  td:first-child { width:64px; color:var(--muted); }
  .empty { padding:18px 12px; color:var(--muted); }
`;

const LeaderboardPage = ({ entries }: LeaderboardPageProps) => (
  <html lang="en">
    <head>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>SSW Snake Leaderboard</title>
      <style>{PAGE_STYLES}</style>
    </head>
    <body>
      <main>
        <h1>Leaderboard</h1>
        <a href="/">Back To Game</a>
        <table aria-label="Leaderboard">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {entries.length > 0 ? (
              entries.map((entry, index) => (
                <tr key={`${entry.player}-${index}`}>
                  <td>{index + 1}</td>
                  <td>{entry.player}</td>
                  <td>{entry.score}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="empty">
                  No scores yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </main>
    </body>
  </html>
);

export const renderLeaderboardHtml = (entries: LeaderboardEntry[]): string =>
  `<!doctype html>${renderToStaticMarkup(<LeaderboardPage entries={entries} />)}`;
