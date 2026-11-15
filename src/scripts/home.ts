// Everything interactive on the home page. No framework needed.

/* ---- Photo / avatar switch ---- */
const face = document.querySelector<HTMLElement>('.face');
const swap = face?.querySelector<HTMLButtonElement>('.swap');
swap?.addEventListener('click', () => {
  const next = face!.dataset.show === 'photo' ? 'avatar' : 'photo';
  face!.dataset.show = next;
  swap.textContent = next === 'photo' ? 'Show avatar' : 'Show photo';
  swap.setAttribute('aria-pressed', String(next === 'avatar'));
});

/* ---- The pipeline: a backup job travels down the page as you scroll ---- */
const main = document.querySelector<HTMLElement>('.pipeline');
const lane = document.querySelector<HTMLElement>('.lane');
const statusBox = document.querySelector<HTMLElement>('.job-status');
const stateEl = document.getElementById('job-state');
const pctEl = document.getElementById('job-pct');

type Stop = { el: HTMLElement; top: number; on: boolean };
type Stage = { name: string; top: number };
type Viz = { el: HTMLElement; kind: string; top: number; height: number; items: HTMLElement[] };
let nodes: Stop[] = [];
let stages: Stage[] = [];
let vizzes: Viz[] = [];
let mainTop = 0;
let mainHeight = 0;
let lastState = '';

// Distance from the top of the pipeline, in page pixels.
const offsetIn = (el: HTMLElement) => el.getBoundingClientRect().top + scrollY - mainTop;

function layout() {
  if (!main || !lane) return;
  const m = main.getBoundingClientRect();
  mainTop = m.top + scrollY;
  mainHeight = main.offsetHeight;
  // Line up the spine with where the node dots sit, whatever the screen width.
  const cs = getComputedStyle(lane);
  const gutter = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gutter')) * parseFloat(getComputedStyle(document.documentElement).fontSize);
  const contentLeft = lane.getBoundingClientRect().left + parseFloat(cs.paddingLeft);
  main.style.setProperty('--spine-x', `${contentLeft - gutter / 2 - m.left}px`);

  nodes = [...main.querySelectorAll<HTMLElement>('[data-node]')].map((el) => {
    const dotTop = parseFloat(getComputedStyle(el, '::before').top) || 0;
    return { el, top: offsetIn(el) + dotTop, on: el.classList.contains('on') };
  });
  stages = [...main.querySelectorAll<HTMLElement>('[data-stage]')].map((el) => ({ name: el.dataset.stage!, top: offsetIn(el) }));
  vizzes = [...main.querySelectorAll<HTMLElement>('[data-viz]')].map((el) => ({
    el,
    kind: el.dataset.viz!,
    top: offsetIn(el),
    height: el.offsetHeight,
    items: [...el.querySelectorAll<HTMLElement>(el.dataset.viz === 'cluster' ? '.slots i' : 'li')],
  }));
  update();
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

function drawCluster(v: Viz, y: number) {
  // 0 to 0.45: nodes spin up one by one, the newest still registering
  // 0.45 to 0.7: everything running, queue drains
  // 0.7 to 1: queue empty, nodes shut down so nobody pays for idle machines
  const t = clamp((y - v.top) / (v.height + innerHeight * 0.45));
  const n = v.items.length;
  let live = 0;
  let joining = 0;
  if (t < 0.45) { live = Math.round((t / 0.45) * n); joining = Math.min(live, 2); }
  else if (t < 0.7) live = n;
  else live = Math.round((1 - (t - 0.7) / 0.3) * n);
  v.items.forEach((el, i) => {
    const s = i < live - joining ? 'running' : i < live ? 'joining' : '';
    if ((el.dataset.s || '') !== s) s ? (el.dataset.s = s) : el.removeAttribute('data-s');
  });
  const jobs = v.el.querySelector('[data-k="jobs"]');
  const running = v.el.querySelector('[data-k="nodes"]');
  if (jobs) jobs.textContent = String(Math.round(24 * (1 - clamp(t / 0.7))));
  if (running) running.textContent = String(live - joining);
}

function drawSteps(v: Viz, y: number) {
  const t = clamp((y - v.top) / (innerHeight * 0.4));
  const lit = Math.floor(t * (v.items.length + 0.999));
  v.items.forEach((el, i) => el.classList.toggle('lit', i < lit));
}

let queued = false;
function update() {
  queued = false;
  if (!main) return;
  const atBottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 4;
  // The packet rides a little below the middle of the screen.
  const y = atBottom ? mainHeight : clamp(scrollY + innerHeight * 0.62 - mainTop, 0, mainHeight);
  main.style.setProperty('--y', `${y}px`);

  for (const n of nodes) {
    const on = n.top <= y;
    if (on !== n.on) { n.on = on; n.el.classList.toggle('on', on); }
  }
  for (const v of vizzes) v.kind === 'cluster' ? drawCluster(v, y) : drawSteps(v, y);

  let state = 'queued';
  for (const s of stages) if (s.top <= y) state = s.name;
  if (atBottom || state === 'complete') state = 'complete';
  if (state !== lastState && stateEl) { stateEl.textContent = state === 'complete' ? 'complete ✓' : state; lastState = state; }
  if (pctEl) pctEl.textContent = `${Math.round((y / Math.max(1, mainHeight)) * 100)}%`;
  statusBox?.classList.toggle('show', y > 0);
}

if (main) {
  document.documentElement.classList.add('js');
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', layout);
  new ResizeObserver(() => layout()).observe(main);
  document.fonts?.ready.then(layout);
  addEventListener('load', layout);
  layout();
}

/* ---- Visitor counter (hidden if the API is not set up yet) ---- */
(async () => {
  const out = document.getElementById('visits');
  if (!out) return;
  let first = true;
  try {
    first = !sessionStorage.getItem('counted');
    sessionStorage.setItem('counted', '1');
  } catch {}
  try {
    const res = await fetch('/api/visits', { method: first ? 'POST' : 'GET' });
    if (!res.ok) return;
    const { visits } = await res.json();
    if (typeof visits === 'number') {
      out.textContent = `${visits.toLocaleString('en-IN')} visits so far`;
      out.hidden = false;
    }
  } catch {}
})();

/* ---- Contact form ---- */
const form = document.getElementById('contact-form') as HTMLFormElement | null;
const note = document.getElementById('contact-note');
function say(kind: 'ok' | 'bad' | '', text: string) {
  if (!note) return;
  note.dataset.kind = kind;
  note.textContent = text;
}
form?.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
  if (!data.name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '') || (data.message || '').trim().length < 10) {
    say('bad', 'Add your name, a valid email and a message of at least 10 characters.');
    return;
  }
  const btn = form.querySelector('button')!;
  btn.disabled = true;
  btn.textContent = 'Sending';
  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...data, token: data['cf-turnstile-response'] || '' }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      form.reset();
      say('ok', 'Message sent. I will reply by email.');
    } else if (res.status === 429) {
      say('bad', 'Too many messages from this network. Try again in an hour.');
    } else if (res.status === 503) {
      say('bad', 'The contact form is not switched on yet. Reach me through the links beside this form.');
    } else {
      say('bad', body.error || 'Message not sent. Check the fields and try again.');
    }
  } catch {
    say('bad', 'Message not sent: no connection. Try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send message';
  }
});
