import { isConfigured } from './lib/supabase.js';
import HostApp from './screens/HostApp.jsx';
import VotePage from './screens/VotePage.jsx';
import ScreenPage from './screens/ScreenPage.jsx';
import { Scene } from './components/ui.jsx';

// Tiny router:
//   /v/<SESSION>  participant (phone)
//   /s/<SESSION>  projector — QR code only
//   /             host control panel (phone)
function route() {
  const path = window.location.pathname;
  const v = path.match(/^\/(?:v|vote)\/([A-Za-z0-9]{4,12})\/?$/);
  if (v) return { page: 'vote', sessionId: v[1].toUpperCase() };
  const s = path.match(/^\/(?:s|screen)\/([A-Za-z0-9]{4,12})\/?$/);
  if (s) return { page: 'screen', sessionId: s[1].toUpperCase() };
  return { page: 'host' };
}

export default function App() {
  return <Page />;
}

function Page() {
  const r = route();
  if (r.page === 'screen') return <ScreenPage sessionId={r.sessionId} />; // needs no database
  if (!isConfigured) return <SetupNotice />;
  return r.page === 'vote' ? <VotePage sessionId={r.sessionId} /> : <HostApp />;
}

function SetupNotice() {
  return (
    <Scene theme="cream">
      <div className="stack stack--center grow">
        <h1 className="title title--lg">Almost there</h1>
        <p className="lead">
          Supabase is not configured. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to{' '}
          <code>.env.local</code> (local) or to Vercel → Settings → Environment Variables, then redeploy.
        </p>
      </div>
    </Scene>
  );
}
