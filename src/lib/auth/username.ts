export function normalizeUsernameToPhone(usernameRaw: string) {
  const username = usernameRaw.trim();
  if (!username) return "";
  return username;
}

// Assumption for this project: "Tên đăng nhập" is a phone number.
// For email/password auth, we map a phone number to a synthetic email.
export function phoneToSyntheticEmail(phone: string) {
  const digits = phone.replace(/[^\d]/g, "");
  return `${digits}@phone.getdriver.local`;
}

export function phoneToLegacySyntheticEmail(phone: string) {
  const clean = phone.replace(/\s+/g, "");
  return `${clean}@getdriver.local`;
}

