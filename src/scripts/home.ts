// Everything interactive on the home page. No framework needed.
document.documentElement.classList.add('js');
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---- Section headings: underline draws once ---- */
const seen = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('seen');
        seen.unobserve(e.target);
      }
    }
  },
  { threshold: 0.6 },
);
document.querySelectorAll('.band > .wrap > h2').forEach((h) => seen.observe(h));

/* ---- Photo / avatar switch ---- */
const face = document.querySelector<HTMLElement>('.face');
const swap = face?.querySelector<HTMLButtonElement>('.swap');
swap?.addEventListener('click', () => {
  const next = face!.dataset.show === 'photo' ? 'avatar' : 'photo';
  face!.dataset.show = next;
  swap.textContent = next === 'photo' ? 'Show avatar' : 'Show photo';
  swap.setAttribute('aria-pressed', String(next === 'avatar'));
});

/* ---- Autoscaler demo ---- */
type Slot = { el: HTMLElement; state: 'off' | 'joining' | 'running'; age: number };
const slots: Slot[] = [...document.querySelectorAll<HTMLElement>('#slots i')].map((el) => ({ el, state: 'off', age: 0 }));
const jobsEl = document.getElementById('jobs')!;
const nodesEl = document.getElementById('nodes')!;
const queueBtn = document.getElementById('queue');
let jobs = 0;
let timer: number | undefined;

function paint() {
  jobsEl.textContent = String(jobs);
  nodesEl.textContent = String(slots.filter((s) => s.state === 'running').length);
  for (const s of slots) s.state === 'off' ? s.el.removeAttribute('data-s') : (s.el.dataset.s = s.state);
}

function tick() {
  const live = slots.filter((s) => s.state !== 'off');
  const wanted = Math.min(slots.length, Math.ceil(jobs / 2));
  // scale up: one new node per tick, it must register before it can work
  if (live.length < wanted) {
    const free = slots.filter((s) => s.state === 'off');
    const pick = free[Math.floor(Math.random() * free.length)];
    if (pick) Object.assign(pick, { state: 'joining', age: 0 });
  }
  for (const s of live) {
    s.age++;
    if (s.state === 'joining' && s.age >= 2) Object.assign(s, { state: 'running', age: 0 });
    else if (s.state === 'running' && s.age % 2 === 0 && jobs > 0) jobs--;
  }
  // scale down: when the queue is empty, release one node per tick
  if (jobs === 0) {
    const idle = slots.find((s) => s.state === 'running');
    if (idle) idle.state = 'off';
  }
  paint();
  if (jobs === 0 && slots.every((s) => s.state === 'off')) {
    clearInterval(timer);
    timer = undefined;
  }
}

function queue(n: number) {
  jobs = Math.min(jobs + n, 48);
  paint();
  timer ??= window.setInterval(tick, calm ? 250 : 420);
}
queueBtn?.addEventListener('click', () => queue(8));
if (slots.length && !calm) setTimeout(() => queue(8), 900);

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
