import { z } from "zod";
import { OCCASIONS, TEMPLATE_IDS, THEME_IDS, TRANSITIONS } from "@/domain/presets";
import { line, paragraph, requiredLine, requiredParagraph } from "@/lib/validation/text";

export const uuid = z.uuid({ version: "v4" });
export const slug = z.string().regex(/^[0-9A-Za-z]{14}$/);
export const collaborationToken = z.string().regex(/^[0-9A-Za-z]{22}$/);

const MAX_RELEASE_MS = 5 * 365 * 24 * 60 * 60 * 1000;

const releaseAt = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .refine(
    (value) => {
      if (value === null) return true;
      const time = Date.parse(value);
      return time > Date.now() + 60_000 && time < Date.now() + MAX_RELEASE_MS;
    },
    { message: "release_out_of_range" },
  );

const emptyToNull = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? null : value), schema.nullable());

export const memoryPatchSchema = z
  .object({
    template_id: z.enum(TEMPLATE_IDS),
    theme: z.enum(THEME_IDS),
    occasion: emptyToNull(z.enum(OCCASIONS)),
    title: line(120),
    recipient_name: line(80),
    sender_name: line(80),
    opening_line: line(140),
    message: paragraph(6000),
    closing_line: paragraph(280),
    release_at: releaseAt,
  })
  .partial()
  .strict();

export type MemoryPatch = z.infer<typeof memoryPatchSchema>;

export const sectionSchema = z
  .object({
    title: line(120),
    body: paragraph(6000),
    event_date: emptyToNull(z.iso.date()),
    transition: z.enum(TRANSITIONS),
  })
  .partial()
  .strict();

export const timelineSchema = z
  .object({
    title: line(120),
    body: paragraph(1200),
    event_date: emptyToNull(z.iso.date()),
    media_id: uuid.nullable(),
  })
  .partial()
  .strict();

export const reorderSchema = z.array(uuid).min(1).max(100);

export const mediaPatchSchema = z
  .object({
    alt: line(200),
    section_id: uuid.nullable(),
  })
  .partial()
  .strict();

export const UPLOAD_LIMITS = {
  image: { maxBytes: 15 * 1024 * 1024, mimes: ["image/jpeg", "image/png", "image/webp"] },
  video: { maxBytes: 45 * 1024 * 1024, mimes: ["video/mp4", "video/quicktime"], maxDurationMs: 60_000 },
  poster: { maxBytes: 3 * 1024 * 1024 },
} as const;

export const uploadRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("image"),
    memoryId: uuid,
    mime: z.enum(UPLOAD_LIMITS.image.mimes),
    size: z.number().int().positive().max(UPLOAD_LIMITS.image.maxBytes),
    sectionId: uuid.nullable().default(null),
  }),
  z.object({
    kind: z.literal("video"),
    memoryId: uuid,
    mime: z.enum(UPLOAD_LIMITS.video.mimes),
    size: z.number().int().positive().max(UPLOAD_LIMITS.video.maxBytes),
    sectionId: uuid.nullable().default(null),
  }),
]);

export const contributionSchema = z.object({
  author: requiredLine(80),
  body: requiredParagraph(2000),
  media: z
    .object({
      kind: z.enum(["image", "video"]),
      mime: z.enum([...UPLOAD_LIMITS.image.mimes, ...UPLOAD_LIMITS.video.mimes]),
      size: z.number().int().positive().max(UPLOAD_LIMITS.video.maxBytes),
    })
    .nullable()
    .default(null),
});

export const responseSchema = z.object({
  author: line(80),
  body: requiredParagraph(2000),
});

export const email = z
  .string()
  .max(254)
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.email());

export const newPassword = z.string().min(10).max(128);

export const collaborationLinkSchema = z.object({
  label: line(60),
  expiresInDays: z.union([z.literal(0), z.literal(3), z.literal(7), z.literal(30)]),
});
