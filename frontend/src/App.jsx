import { useEffect, useState } from 'react';

export default function App() {
  const [resume, setResume] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [name, setName] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiStatus, setApiStatus] = useState('Checking API…');

  async function loadHistory() {
    try {
      const response = await fetch('/api/reviews');
      const data = await response.json();
      if (response.ok) setHistory(data.reviews || []);
    } catch {
      // The main form remains usable even if history is temporarily unavailable.
    }
  }

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => setApiStatus(data.ok ? 'API online' : 'API issue'))
      .catch(() => setApiStatus('API unavailable'));
    loadHistory();
  }, []);

  async function submitReview(event) {
    event.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, resume, jobDescription })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not review this resume.');
      setResult(data.review);
      await loadHistory();
    } catch (err) {
      setError(err.message || 'Something went wrong. Check the backend and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <nav className="topbar">
        <a className="brand" href="#"><span className="brand-mark">R</span> Resume Roaster</a>
        <span className={`status ${apiStatus === 'API online' ? 'online' : ''}`}><i />{apiStatus}</span>
      </nav>

      <section className="hero">
        <div className="eyebrow"><span>✦</span> YOUR NEXT ROLE STARTS HERE</div>
        <h1>Make your resume<br /><em>impossible to ignore.</em></h1>
        <p className="hero-copy">Get direct, actionable feedback on your resume and how well it matches the job you want.</p>
      </section>

      <section className="workspace">
        <form className="panel form-panel" onSubmit={submitReview}>
          <div className="panel-heading">
            <div><span className="step">01</span><h2>Roast my resume</h2></div>
            <span className="required-label">ALL FIELDS REQUIRED*</span>
          </div>
          <label htmlFor="name">YOUR NAME <span>(optional)</span></label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="How should we address you?" maxLength={80} />
          <label htmlFor="resume">YOUR RESUME <span>· paste text</span></label>
          <textarea id="resume" required minLength={40} maxLength={20000} value={resume} onChange={(e) => setResume(e.target.value)} placeholder="Paste your resume text here — experience, skills, projects, education…" rows={9} />
          <div className="field-foot"><span>Plain text works best</span><span>{resume.length.toLocaleString()} / 20,000</span></div>
          <label htmlFor="job">TARGET JOB DESCRIPTION</label>
          <textarea id="job" required minLength={20} maxLength={12000} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste the job description you're targeting…" rows={6} />
          <button className="submit" type="submit" disabled={loading}>{loading ? 'Reviewing your resume…' : '✦  Roast my resume'} <span>↗</span></button>
          {error && <p className="error" role="alert">{error}</p>}
          <p className="privacy-note">Your review is stored in your configured database. Do not submit confidential personal information.</p>
        </form>

        <aside className="right-column">
          <section className="panel result-panel">
            <div className="panel-heading"><div><span className="step">02</span><h2>Your feedback</h2></div></div>
            {!result ? (
              <div className="empty-state">
                <div className="sparkle">✳</div>
                <h3>Your honest review<br />starts here.</h3>
                <p>Submit your resume and a target job description to see strengths, gaps, and next steps.</p>
                <div className="mini-tags"><span>ATS tips</span><span>Skill gaps</span><span>Action plan</span></div>
              </div>
            ) : (
              <div className="feedback">
                <div className="score-row"><div><small>RESUME MATCH SCORE</small><div className="score">{result.score}<span>/100</span></div></div><span className="score-caption">{result.score >= 75 ? 'Strong starting point' : result.score >= 50 ? 'Room to improve' : 'Needs a rewrite'}</span></div>
                <p className="summary">{result.summary}</p>
                <FeedbackList title="WHAT'S WORKING" items={result.strengths} />
                <FeedbackList title="WHAT TO IMPROVE" items={result.improvements} />
                <FeedbackList title="YOUR ACTION PLAN" items={result.actionPlan} />
                <p className="powered">{result.aiGenerated ? '✦ AI-assisted feedback' : '✦ Rule-based feedback · add GEMINI_API_KEY for AI feedback'}</p>
              </div>
            )}
          </section>
          <section className="panel history-panel">
            <div className="panel-heading"><div><span className="step">03</span><h2>Recent reviews</h2></div><button className="refresh" type="button" onClick={loadHistory} aria-label="Refresh review history">↻</button></div>
            {history.length === 0 ? <p className="history-empty">Your saved reviews will appear here once the database is connected.</p> :
              <ul className="history-list">{history.map((item) => <li key={item._id}><div><strong>{item.name || 'Anonymous review'}</strong><small>{new Date(item.createdAt).toLocaleString()}</small></div><span className="history-score">{item.score}/100</span></li>)}</ul>}
          </section>
        </aside>
      </section>
      <footer><span>RESUME ROASTER</span><span>Built for your next opportunity.</span></footer>
    </main>
  );
}

function FeedbackList({ title, items }) {
  return <section className="feedback-list"><h4>{title}</h4><ul>{(items || []).map((item, i) => <li key={`${title}-${i}`}>{item}</li>)}</ul></section>;
}
