export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function parsePagination(query: any, defaultSortBy: string = 'created_at', allowedSortFields: string[] = ['created_at', 'date', 'settled_at']): {
  page: number;
  limit: number;
  offset: number;
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
} {
  const page = Math.max(1, parseInt(query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string, 10) || 20));
  const offset = (page - 1) * limit;

  let sortBy = defaultSortBy;
  if (query.sortBy && allowedSortFields.includes(query.sortBy as string)) {
    sortBy = query.sortBy as string;
  }

  const sortOrder: 'ASC' | 'DESC' = query.sortOrder?.toString().toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  return { page, limit, offset, sortBy, sortOrder };
}
