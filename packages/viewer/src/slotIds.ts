/**
 * Shared slot-id constants.
 *
 * Slot ids follow `VM_Slot_K{zone}_{face}_{nn}` where zone is one or more digits and face is one of
 * CD (chinh dien), MT (mat trai), MP (mat phai), AT (anh treo), AD (anh dung).
 */

/** The wide hero banner panel by the exit (zone 9). Was `VM_Slot_TT_9000` before the K-zone rename. */
export const HERO_SLOT_ID = 'VM_Slot_K9_CD_01'

export function isBackdropSlotId(slotId: string): boolean {
  return slotId === HERO_SLOT_ID
}
