// Base types matching backend models

export interface Organization {
  id: string;
  name: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationCreate {
  name: string;
  display_name: string;
}

export interface OrganizationUpdate {
  name?: string;
  display_name?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  namespace_id: string;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowCreate {
  name: string;
  namespace_id: string;
  description?: string;
}

export interface WorkflowUpdate {
  name?: string;
  description?: string;
  namespace_id?: string;
}

export interface Namespace {
  id: string;
  name: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface NamespaceCreate {
  name: string;
  organization_id: string;
}

export interface NamespaceUpdate {
  name?: string;
}

// User from whoami endpoint
export interface User {
  id: string;
  workos_user_id: string;
  created_at: string | null;
}

// Generic list response wrapper
export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

// API Error response
export interface ApiErrorResponse {
  detail: string;
  message?: string;
}