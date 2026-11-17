export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export class ResponseShapeError extends ApiError {
  constructor() { super('응답 형식이 올바르지 않아요. 다시 시도해 주세요.', 502); }
}
