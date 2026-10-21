import { whenOfficeReady } from "@/lib/outlook-office";

export const SMARTCRM_OUTLOOK_CATEGORY = "SmartCRM";

/**
 * Put the SmartCRM category on the mail that is open, so the inbox shows it is connected.
 * Best-effort: a missing Office host must not block the save.
 */
export async function showSmartCrmCategoryOnOpenMail(): Promise<void> {
  const office = await whenOfficeReady(4_000);
  const mailbox = office?.context?.mailbox;
  const item = mailbox?.item;
  if (!mailbox || !item?.categories?.addAsync) return;

  await ensureSmartCrmMasterCategory(mailbox);
  await new Promise<void>((resolve) => {
    item.categories?.addAsync([SMARTCRM_OUTLOOK_CATEGORY], () => resolve());
  });
}

function ensureSmartCrmMasterCategory(mailbox: Office.Mailbox): Promise<void> {
  const master = mailbox.masterCategories;
  if (!master?.getAsync || !master.addAsync) return Promise.resolve();

  return new Promise((resolve) => {
    master.getAsync((result) => {
      const existing = Array.isArray(result.value) ? result.value : [];
      const already = (existing ?? []).some(
        (category) => category.displayName?.trim().toLowerCase() === SMARTCRM_OUTLOOK_CATEGORY.toLowerCase(),
      );
      if (already) {
        resolve();
        return;
      }
      master.addAsync(
        [{ displayName: SMARTCRM_OUTLOOK_CATEGORY, color: "Preset1" }],
        () => resolve(),
      );
    });
  });
}
