export type CompanyInfo = {
  name: string;
  phone: string;
  email: string;
  website: string;
  representative: string;
  address: string;
  taxCode: string;
  updatedAt: number;
};

const KEY = "getdriver.company.info.v1";

const DEFAULT: CompanyInfo = {
  name: "Get Driver Vietnam",
  phone: "+84 28 3820 5555",
  email: "contact@getdriver.vn",
  website: "www.getdriver.vn",
  representative: "Nguyễn Văn A",
  address: "123 Đường Nguyễn Hữu Cảnh, Quận Bình Thạnh, TPHCM",
  taxCode: "0123456789",
  updatedAt: Date.now(),
};

function safeParse(raw: string | null): CompanyInfo | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CompanyInfo;
  } catch {
    return null;
  }
}

export function getCompanyInfo(): CompanyInfo {
  const existing = safeParse(localStorage.getItem(KEY));
  if (existing) return existing;
  localStorage.setItem(KEY, JSON.stringify(DEFAULT));
  return DEFAULT;
}

export function setCompanyInfo(next: CompanyInfo) {
  localStorage.setItem(KEY, JSON.stringify(next));
}

