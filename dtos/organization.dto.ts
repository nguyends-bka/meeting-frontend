export interface OrganizationUnitItem {
  id: string;
  name: string;
  code: string;
  level: number;
  parentId: string | null;
  parentName?: string | null;
  description?: string | null;
  isActive: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface OrganizationUnitUpsertRequest {
  name: string;
  code: string;
  level: number;
  parentId: string | null;
  description?: string | null;
  isActive: boolean;
}
