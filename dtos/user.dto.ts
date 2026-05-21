export * from './user/user.dto';
// Frontend DTOs for User domain

/** Kết quả tra cứu theo username (mời họp). */
export interface UserLookupByUsername {
  userId: string;
  username: string;
  fullName: string | null;
}

/** Một quốc gia trong dropdown catalog. */
export interface CountryOption {
  code: string;
  countryName: string;
}

/** Một ngôn ngữ trong dropdown catalog. */
export interface LanguageOption {
  code: string;
  languageName: string;
}

/** Quốc tịch/quốc gia trong response của user. */
export interface UserCountryItem {
  code: string;
  countryName: string;
}

/** Ngôn ngữ trong response của user, kèm cờ primary. */
export interface UserLanguageItem {
  code: string;
  languageName: string;
  isPrimary: boolean;
}

/** Một phần tử trong danh sách languages khi cập nhật profile. */
export interface UserLanguageRequest {
  code: string;
  isPrimary: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  role: string;
  fullName: string | null;
  email: string | null;
  position: string | null;
  academicRank: 'GS' | 'PGS' | null;
  academicDegree: 'TS' | 'ThS' | 'CN' | 'KS' | null;
  organizationUnitId: string | null;
  organizationUnitName: string | null;
  avatar: string | null;
  hasFaceEmbedding?: boolean;
  createdAt: string;
  /** Danh sách quốc tịch/quốc gia của user. */
  countries: UserCountryItem[];
  /** Danh sách ngôn ngữ của user. */
  languages: UserLanguageItem[];
}

export interface UpdateProfileRequest {
  fullName?: string | null;
  email?: string | null;
  position?: string | null;
  academicRank?: 'GS' | 'PGS' | null;
  academicDegree?: 'TS' | 'ThS' | 'CN' | 'KS' | null;
  organizationUnitId?: string | null;
  avatar?: string | null;
  /** Null = không thay đổi; [] = xóa toàn bộ; ['VN','US'] = thay thế hoàn toàn. */
  countryCodes?: string[] | null;
  /** Null = không thay đổi; [] = xóa toàn bộ; danh sách đầy đủ = thay thế hoàn toàn. */
  languages?: UserLanguageRequest[] | null;
}

export interface UpdateProfileResponse {
  message: string;
  user: {
    id: string;
    username: string;
    role: string;
    fullName: string | null;
    email: string | null;
    position: string | null;
    academicRank: 'GS' | 'PGS' | null;
    academicDegree: 'TS' | 'ThS' | 'CN' | 'KS' | null;
    organizationUnitId: string | null;
    organizationUnitName: string | null;
    avatar: string | null;
    countries: UserCountryItem[];
    languages: UserLanguageItem[];
  };
}

export interface OrganizationUnitOption {
  id: string;
  name: string;
  level: number;
  parentId: string | null;
  isActive: boolean;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  message: string;
}
