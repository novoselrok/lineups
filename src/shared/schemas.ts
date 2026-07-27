import { z } from 'zod';
import { FORMATIONS } from './formations';
import { KIT_PATTERNS } from './kits';
import { POSITION_ROLES } from './roles';

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a 6-digit hex colour, e.g. #c8102e');

export const kitSchema = z.object({
  shirt: hexColor,
  sleeve: hexColor,
  shorts: hexColor,
  number: hexColor,
  pattern: z.enum(KIT_PATTERNS),
});

export const positionRoleSchema = z.enum(POSITION_ROLES);

export const clubSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().min(1),
  kit: kitSchema,
});

export const playerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  clubId: z.string().min(1),
  number: z.number().int().min(1).max(99),
  roles: z.array(positionRoleSchema).min(1),
});

const formationIds = FORMATIONS.map((f) => f.id);
const slotIdsByFormation = new Map(
  FORMATIONS.map((f) => [f.id, new Set(f.slots.map((s) => s.id))]),
);

const lineupFields = {
  name: z.string().trim().min(1, 'Give the lineup a name').max(80),
  formationId: z.string().refine((id) => formationIds.includes(id), {
    message: `Unknown formation. Expected one of: ${formationIds.join(', ')}`,
  }),
  assignments: z.record(z.string().min(1), z.string().min(1)),
  kitMode: z.enum(['club', 'custom']),
  customKit: kitSchema.nullable(),
};

interface AssignmentShape {
  formationId: string;
  assignments: Record<string, string>;
}

/**
 * Assignments must reference slots that exist in the chosen formation, and no player
 * may occupy two slots. Shared by the request body and the on-disk file so a
 * hand-edited store file fails loudly rather than rendering a broken pitch.
 */
function checkAssignments(value: AssignmentShape, ctx: z.RefinementCtx): void {
  const slotIds = slotIdsByFormation.get(value.formationId);
  if (!slotIds) return; // formationId already reported by its own refinement

  for (const slotId of Object.keys(value.assignments)) {
    if (!slotIds.has(slotId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['assignments', slotId],
        message: `Slot "${slotId}" does not exist in formation ${value.formationId}`,
      });
    }
  }

  const seen = new Map<string, string>();
  for (const [slotId, playerId] of Object.entries(value.assignments)) {
    const previous = seen.get(playerId);
    if (previous) {
      ctx.addIssue({
        code: 'custom',
        path: ['assignments', slotId],
        message: `Player "${playerId}" is already assigned to slot "${previous}"`,
      });
    } else {
      seen.set(playerId, slotId);
    }
  }
}

/** Body accepted by POST /api/lineups and PUT /api/lineups/:id. */
export const lineupInputSchema = z.object(lineupFields).superRefine(checkAssignments);

export type LineupInputPayload = z.infer<typeof lineupInputSchema>;

/** A lineup as stored on disk, including server-owned fields. */
export const persistedLineupSchema = z
  .object({
    ...lineupFields,
    id: z.string().min(1),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  })
  .superRefine(checkAssignments);

export const storeFileSchema = z.object({
  version: z.literal(1),
  lineups: z.array(persistedLineupSchema),
});

export type StoreFile = z.infer<typeof storeFileSchema>;
