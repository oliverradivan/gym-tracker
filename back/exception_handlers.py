from fastapi import Request
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError


class DatabaseOperationError(Exception):
    def __init__(self, operation: str, message: str):
        super().__init__(message)
        self.operation = operation
        self.message = message


def execute_query(query, operation: str):
    try:
        return query.execute()
    except APIError as exc:
        raise DatabaseOperationError(operation, exc.message) from exc


async def database_operation_error_handler(
    _request: Request, exc: DatabaseOperationError
) -> JSONResponse:
    detail = f"{exc.operation}: {exc.message}" if exc.operation else exc.message
    return JSONResponse(
        status_code=400,
        content={"detail": detail},
    )


async def api_error_handler(_request: Request, exc: APIError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": exc.message})
