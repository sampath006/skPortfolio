// The editing panel. It builds its form from the profile data itself, so any
// field added to shared/schema.ts and profile.json shows up here automatically.
import { ProfileSchema, BLANKS, issuesOf } from '../../shared/schema';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const gate = $('gate');
const panel = $('panel');
const status = $('status');
const issues = $('issues');
const formEl = $('form');
const here = document.querySelector<HTMLElement>('.editor')?.dataset.path || '/';

let profile: Record<string, any> = {};

const LABELS: Record<string, string> = {
  shortName: 'Short name', pitch: 'Headline', availability: 'Availability line', timezone: 'Time zone',
  stack: 'Main technologies', about: 'About me', links: 'Links', githubUsername: 'GitHub username',
  featuredRepos: 'Featured GitHub repos', experience: 'Experience', caseStudies: 'Case studies',
  projects: 'Projects', education: 'Education', achievements: 'Achievements', skills: 'Skills',
  interests: 'Beyond code', gallery: 'Gallery', url: 'Link', start: 'Start (e.g. Jan 2026)', end: 'End',
  bullets: 'Bullet points', file: 'Photo file', approach: 'What I did', problem: 'The problem', result: 'The result',
};
const LONG = new Set(['about', 'problem', 'approach', 'result', 'description', 'text', 'summary', 'detail', 'bullets']);
const label = (key: string) => LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
const singular = (key: string) => label(key).replace(/ies$/, 'y').replace(/s$/, '').toLowerCase();

function say(kind: 'ok' | 'bad' | '', text: string, list: string[] = []) {
  status.dataset.kind = kind;
  status.textContent = text;
  issues.replaceChildren(...list.map((t) => Object.assign(document.createElement('li'), { textContent: t })));
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids);
  return node;
}

let uid = 0;
function textField(owner: any, key: string | number, name: string, hideLabel = false): HTMLElement {
  const id = `f${uid++}`;
  const long = LONG.has(name);
  const input = el(long ? 'textarea' : 'input', { id, value: owner[key] ?? '' } as any);
  if (hideLabel) input.setAttribute('aria-label', label(name));
  input.addEventListener('input', () => (owner[key] = input.value));
  const box = el('div', { className: 'field' });
  if (!hideLabel) box.append(el('label', { htmlFor: id, textContent: label(name) }));
  box.append(input);
  return box;
}

function listField(owner: any, key: string): HTMLElement {
  const box = el('div', { className: 'ed-list' });
  const draw = () => {
    const arr: any[] = owner[key];
    box.replaceChildren(el('span', { className: 'ed-label', textContent: label(key) }));
    arr.forEach((item, i) => {
      const body = typeof item === 'string' ? textField(arr, i, key, true) : objectField(item);
      const move = (to: number) => () => { if (to >= 0 && to < arr.length) { [arr[i], arr[to]] = [arr[to], arr[i]]; draw(); } };
      const tools = el('div', { className: 'ed-tools' },
        el('button', { type: 'button', textContent: 'Up', onclick: move(i - 1), disabled: i === 0 }),
        el('button', { type: 'button', textContent: 'Down', onclick: move(i + 1), disabled: i === arr.length - 1 }),
        el('button', { type: 'button', textContent: 'Remove', onclick: () => { arr.splice(i, 1); draw(); } }),
      );
      box.append(el('div', { className: 'ed-row' }, body, tools));
    });
    box.append(el('button', {
      type: 'button', className: 'ed-add', textContent: `Add ${singular(key)}`,
      onclick: () => { arr.push(structuredClone(BLANKS[key] ?? '')); draw(); },
    }));
  };
  draw();
  return box;
}

function objectField(obj: Record<string, any>): HTMLElement {
  const box = el('div', { className: 'ed-item' });
  for (const k of Object.keys(obj)) box.append(fieldFor(obj, k));
  return box;
}

function fieldFor(owner: any, key: string): HTMLElement {
  const v = owner[key];
  if (Array.isArray(v)) return listField(owner, key);
  if (v && typeof v === 'object') return objectField(v);
  return textField(owner, key, key);
}

function drawForm() {
  uid = 0;
  const basics = ['name', 'shortName', 'title', 'pitch', 'location', 'availability', 'timezone', 'about', 'stack'];
  const sections: [string, string[]][] = [
    ['Basics', basics],
    ['Links and GitHub', ['links', 'githubUsername', 'featuredRepos']],
    ...Object.keys(profile).filter((k) => !basics.includes(k) && !['links', 'githubUsername', 'featuredRepos'].includes(k)).map((k) => [label(k), [k]] as [string, string[]]),
  ];
  formEl.replaceChildren(
    ...sections.map(([title, keys]) => {
      const body = el('div', { className: 'ed-body' });
      for (const k of keys) if (k in profile) body.append(fieldFor(profile, k));
      return el('details', { className: 'ed-sec' }, el('summary', { textContent: title }), body);
    }),
  );
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function save(to: 'main' | 'preview') {
  const checked = ProfileSchema.safeParse(profile);
  if (!checked.success) return say('bad', 'Not saved. Fix these fields first:', issuesOf(checked.error));
  say('', to === 'main' ? 'Publishing' : 'Saving preview');
  const { res, body } = await api(`/api/admin/profile${to === 'preview' ? '?to=preview' : ''}`, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(checked.data),
  });
  if (res.status === 401) return start();
  if (!res.ok) return say('bad', body.error || 'Not saved.', body.issues || []);
  say('ok', to === 'main'
    ? 'Published. The live site updates in about two minutes.'
    : 'Saved to preview. Open the "preview" branch link in your Cloudflare Pages project in about two minutes.');
}

// Shrink a photo in the browser so the repo stays small.
async function toJpegBase64(file: File, maxSide: number): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = el('canvas', { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) });
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.84).split(',')[1];
}

async function upload(kind: 'portrait' | 'gallery', input: HTMLInputElement) {
  const file = input.files?.[0];
  if (!file) return;
  say('', 'Uploading photo');
  try {
    const data = await toJpegBase64(file, kind === 'portrait' ? 900 : 1600);
    const { res, body } = await api('/api/admin/photo', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, name: file.name, data }),
    });
    if (!res.ok) return say('bad', body.error || 'Photo not uploaded.');
    if (kind === 'gallery') {
      const caption = $<HTMLInputElement>('up-caption');
      profile.gallery.push({ file: body.file, caption: caption.value.trim() });
      caption.value = '';
      drawForm();
      say('ok', 'Photo uploaded. Press Publish to show it in the gallery.');
    } else {
      say('ok', 'Photo uploaded. It appears on the site in about two minutes.');
    }
  } catch {
    say('bad', 'That file could not be read as an image.');
  } finally {
    input.value = '';
  }
}

async function start() {
  const me = await api('/api/admin/me');
  if (!me.res.ok) {
    panel.hidden = true;
    gate.hidden = false;
    $<HTMLAnchorElement>('signin').href = `/api/admin/login?back=${encodeURIComponent(here)}`;
    return;
  }
  $('who').textContent = `Signed in as ${me.body.login}`;
  gate.hidden = true;
  panel.hidden = false;
  const got = await api('/api/admin/profile');
  if (!got.res.ok) return say('bad', got.body.error || 'Could not load the profile.');
  profile = got.body.profile;
  drawForm();
}

$('publish').addEventListener('click', () => save('main'));
$('preview').addEventListener('click', () => save('preview'));
$('signout').addEventListener('click', async () => { await api('/api/admin/logout', { method: 'POST' }); location.reload(); });
$<HTMLInputElement>('up-portrait').addEventListener('change', (e) => upload('portrait', e.target as HTMLInputElement));
$<HTMLInputElement>('up-gallery').addEventListener('change', (e) => upload('gallery', e.target as HTMLInputElement));
start();
