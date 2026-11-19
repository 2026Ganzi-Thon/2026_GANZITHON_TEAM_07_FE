export class ApiError extends Error {
  /** code/details come from the backend envelope (`error.code`, failure `data`); preview responses leave them empty. */
  constructor(message: string, readonly status: number, readonly code?: string, readonly details?: unknown) { super(message); }
}
export class ResponseShapeError extends ApiError {
  constructor() { super('응답 형식이 올바르지 않아요. 다시 시도해 주세요.', 502); }
}
