from fastapi import APIRouter
from apps.api.app.schemas import OCRParseRequest, OCRParseResponse
from apps.api.app.engine.ocr_service import OCRLocationService

router = APIRouter()


@router.post("/parse-location", response_model=OCRParseResponse)
async def parse_location_from_ocr(request: OCRParseRequest):
    """
    Parses unstructured text, delivery slips, invoices, or coordinates
    into structured verified address and geographic coordinates.
    """
    return await OCRLocationService.parse_location_from_input(request)
