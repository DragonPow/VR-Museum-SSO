import { z } from 'zod'

export const GUESTBOOK_COLOR_PRESETS = ['yellow', 'pink', 'green', 'blue', 'white'] as const
export const GUESTBOOK_STATUSES = ['pending', 'approved', 'rejected'] as const
export const GUESTBOOK_SORT_MODES = ['priority', 'newest', 'oldest', 'random'] as const

export const GuestbookEventSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Tên sự kiện không được trống').max(100),
  color: z.string().optional(),
  description: z.string().max(300).optional(),
  isActive: z.boolean().optional().default(true),
  createdAt: z.string().optional(),
})

export const GuestbookNoteSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1).max(500),
  signature: z.string().max(100).nullable().optional(),
  colorPreset: z.enum(GUESTBOOK_COLOR_PRESETS),
  rotation: z.number().min(-15).max(15),
  status: z.enum(GUESTBOOK_STATUSES),
  isPinned: z.boolean().optional().default(false),
  isVisible: z.boolean().optional().default(true),
  priority: z.number().int().optional().default(0),
  eventTag: z.string().nullable().optional(),
  authorId: z.string().nullable().optional(),
  createdAt: z.string(),
})

export const GuestbookSubmitSchema = z.object({
  content: z.string().trim().min(2, 'Nội dung tối thiểu 2 ký tự').max(500, 'Nội dung tối đa 500 ký tự'),
  signature: z.string().trim().max(100, 'Chữ ký tối đa 100 ký tự').optional(),
  visitorId: z.string().trim().optional(),
})

export const GuestbookModerateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(GUESTBOOK_STATUSES),
})

export const GuestbookToggleSchema = z.object({
  id: z.string().min(1),
  isPinned: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  priority: z.number().int().optional(),
  eventTag: z.string().nullable().optional(),
})

export const GuestbookBulkActionSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'Chọn ít nhất 1 lời nhắn'),
  action: z.enum(['approve', 'reject', 'delete', 'hide', 'show', 'pin', 'unpin', 'priority', 'set_event']),
  priority: z.number().int().optional(),
  eventTag: z.string().nullable().optional(),
})
