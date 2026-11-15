import { z } from 'zod';

// One schema for everything: the site build, the admin panel and the API all
// validate against this, so a bad edit can never reach the live site.

const text = (max = 200) => z.string().trim().min(1, 'Required').max(max);
const optional = (max = 200) => z.string().trim().max(max);
const link = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^https?:\/\/[^\s]+$/i.test(v), 'Must start with https://');
const email = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Not a valid email');
const tags = z.array(text(40)).max(12);

export const ProfileSchema = z.object({
  name: text(80),
  shortName: text(40),
  title: text(80),
  pitch: text(160),
  location: text(80),
  availability: optional(120),
  timezone: optional(60),
  stack: tags,
  about: text(900),
  links: z.object({ github: link, linkedin: link, email }),
  githubUsername: optional(40),
  featuredRepos: z.array(text(100)).max(8),
  experience: z
    .array(
      z.object({
        role: text(80),
        company: text(80),
        place: optional(80),
        start: text(20),
        end: text(20),
        bullets: z.array(text(240)).max(8),
      }),
    )
    .max(12),
  caseStudies: z
    .array(
      z.object({
        title: text(100),
        summary: text(240),
        problem: text(600),
        approach: text(800),
        result: text(400),
        tags,
      }),
    )
    .max(8),
  projects: z
    .array(z.object({ name: text(80), description: text(300), url: link, tags }))
    .max(12),
  education: z
    .array(z.object({ degree: text(100), school: text(100), years: text(30), detail: optional(120) }))
    .max(4),
  achievements: z.array(z.object({ title: text(80), detail: optional(240) })).max(10),
  skills: z.array(z.object({ group: text(40), items: z.array(text(40)).max(20) })).max(8),
  interests: z.array(z.object({ title: text(60), text: text(300) })).max(8),
  gallery: z
    .array(
      z.object({
        file: z.string().regex(/^[a-z0-9][a-z0-9-]*\.(jpg|jpeg|png|webp)$/, 'Use an uploaded file name'),
        caption: optional(120),
      }),
    )
    .max(24),
});

export type Profile = z.infer<typeof ProfileSchema>;

// Empty shapes the admin panel uses when you press "Add".
export const BLANKS: Record<string, unknown> = {
  stack: '',
  featuredRepos: '',
  bullets: '',
  tags: '',
  items: '',
  experience: { role: '', company: '', place: '', start: '', end: 'Present', bullets: [''] },
  caseStudies: { title: '', summary: '', problem: '', approach: '', result: '', tags: [] },
  projects: { name: '', description: '', url: '', tags: [] },
  education: { degree: '', school: '', years: '', detail: '' },
  achievements: { title: '', detail: '' },
  skills: { group: '', items: [''] },
  interests: { title: '', text: '' },
  gallery: { file: '', caption: '' },
};

export function issuesOf(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(' › ') || 'profile'}: ${i.message}`);
}
