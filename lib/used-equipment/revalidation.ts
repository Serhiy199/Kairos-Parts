import 'server-only';

import { revalidatePath } from 'next/cache';

export function revalidateUsedEquipmentInquiryAdminPaths(inquiryId?: string) {
  revalidatePath('/admin', 'layout');
  revalidatePath('/admin/used-equipment/inquiries');

  if (inquiryId) {
    revalidatePath(`/admin/used-equipment/inquiries/${inquiryId}`);
  }
}
