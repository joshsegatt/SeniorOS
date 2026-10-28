/**
 * Email addresses that get the weekly newsletter (customers who opted in and are not deleted).
 * Reads the table directly: the mailer runs this over the whole customer base every week.
 * @param {ReturnType<import('../accounts/db.js').createDb>} db
 */
export function newsletterRecipients(db) {
  const emails = [];
  for (const c of db.customers.values()) {
    if (c.newsletter && !c.deletedAt) emails.push(c.email);
  }
  return emails.sort();
}
