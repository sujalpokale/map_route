import io
import re
import time
import asyncio
import base64
import logging
from typing import List, Optional, Tuple

import httpx
from PIL import Image, ImageEnhance, ImageFilter, ImageOps, ExifTags

from apps.api.app.core.config import settings
from apps.api.app.schemas import (
    OCRParseRequest,
    OCRParseResponse,
    ParsedLocation,
    GeoPoint,
    ValidationDetails,
    ConfidenceBreakdown,
)
from apps.api.app.providers.geocoding import get_geocoding_provider
from apps.api.app.engine.address_validator import (
    AddressValidator,
    PINCODE_PREFIX_TO_STATE,
    MAJOR_CITIES,
)

logger = logging.getLogger(__name__)

# ── EasyOCR lazy singleton (offline local fallback) ───────────────────────────
_easyocr_reader = None


def _get_easyocr_reader():
    global _easyocr_reader
    if _easyocr_reader is None:
        try:
            import easyocr
            logger.info("Initializing EasyOCR reader (CPU fallback)...")
            _easyocr_reader = easyocr.Reader(["en"], gpu=False, verbose=False)
            logger.info("EasyOCR reader initialized.")
        except Exception as e:
            logger.warning(f"EasyOCR reader unavailable: {e}")
    return _easyocr_reader


class OCRLocationService:
    COORDINATES_REGEX = re.compile(
        r"(?:lat|latitude)[:\s]*([+-]?\d{1,2}\.\d{3,})\s*(?:[,\s|/]+)\s*(?:lon|lng|long|longitude)[:\s]*([+-]?\d{1,3}\.\d{3,})",
        re.IGNORECASE,
    )

    @classmethod
    def _extract_gps_from_exif(cls, img_bytes: bytes) -> Optional[Tuple[float, float]]:
        """Extracts latitude & longitude from photo EXIF metadata if present."""
        try:
            image = Image.open(io.BytesIO(img_bytes))
            exif_data = image._getexif()
            if not exif_data:
                return None

            gps_info = {}
            for tag_id, value in exif_data.items():
                tag_name = ExifTags.TAGS.get(tag_id, tag_id)
                if tag_name == "GPSInfo":
                    for sub_tag_id, sub_val in value.items():
                        sub_tag_name = ExifTags.GPSTAGS.get(sub_tag_id, sub_tag_id)
                        gps_info[sub_tag_name] = sub_val

            if "GPSLatitude" in gps_info and "GPSLongitude" in gps_info:
                lat_ref = gps_info.get("GPSLatitudeRef", "N")
                lng_ref = gps_info.get("GPSLongitudeRef", "E")
                lat_dms = gps_info["GPSLatitude"]
                lng_dms = gps_info["GPSLongitude"]

                def dms_to_dd(dms):
                    deg = float(dms[0])
                    mins = float(dms[1])
                    secs = float(dms[2])
                    return deg + (mins / 60.0) + (secs / 3600.0)

                lat = dms_to_dd(lat_dms)
                if lat_ref == "S":
                    lat = -lat

                lng = dms_to_dd(lng_dms)
                if lng_ref == "W":
                    lng = -lng

                return (round(lat, 6), round(lng, 6))
        except Exception as e:
            logger.debug(f"EXIF GPS extraction skipped: {e}")
        return None

    @classmethod
    def _is_valid_indian_location(cls, point: GeoPoint) -> bool:
        """Validates that a geocoded point is located within India."""
        if not point:
            return False
        if point.country and "india" not in point.country.lower():
            return False
        # India bounding box: lat 6.5 to 37.5, lng 68.0 to 97.5
        if not (6.5 <= point.lat <= 37.5 and 68.0 <= point.lng <= 97.5):
            return False
        return True

    @classmethod
    async def parse_location_from_input(cls, request: OCRParseRequest) -> OCRParseResponse:
        """
        Production OCR & Address Extraction Pipeline:
        IMAGE -> Preprocessing -> OCR Engine -> Raw OCR Text
              -> Address Parsing -> Address Validation (Pincode/City/State)
              -> Full-Address Geocoding -> Consistency Validation
              -> Dynamic Confidence Calculation -> Structured Output
        """
        start_time = time.time()
        extracted_text = ""
        ocr_confidence_raw = 0.90
        coords_from_exif: Optional[Tuple[float, float]] = None

        # ── 1. Process Image Base64 (Cloud OCR.Space or Local EasyOCR) ────────
        if request.image_base64:
            try:
                raw_b64 = request.image_base64
                if "," in raw_b64:
                    raw_b64 = raw_b64.split(",", 1)[1]
                img_bytes = base64.b64decode(raw_b64)
                coords_from_exif = cls._extract_gps_from_exif(img_bytes)

                # Preprocess PIL image for clarity & orientation
                pil_img = Image.open(io.BytesIO(img_bytes))
                try:
                    pil_img = ImageOps.exif_transpose(pil_img)
                except Exception:
                    pass

                if pil_img.mode != "RGB":
                    pil_img = pil_img.convert("RGB")

                # Capping dimensions for OCR speed while preserving crisp resolution
                max_dim = 1600
                if max(pil_img.width, pil_img.height) > max_dim:
                    pil_img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

                # Execute OCR Engine
                extracted_text, ocr_confidence_raw = await cls._execute_ocr_engine(pil_img, raw_b64)
                logger.info(f"OCR extracted ({len(extracted_text)} chars, conf={ocr_confidence_raw}): {extracted_text[:120]}")

            except Exception as e:
                logger.warning(f"Image OCR processing notice: {e}")

        # ── 2. Handle Text Input ──────────────────────────────────────────────
        if request.raw_text:
            if extracted_text:
                extracted_text = extracted_text + "\n" + request.raw_text
            else:
                extracted_text = request.raw_text
                ocr_confidence_raw = 0.95

        # ── 3. Case: No Image and No Text ─────────────────────────────────────
        if not extracted_text.strip() and not coords_from_exif and request.latitude is None:
            elapsed_ms = round((time.time() - start_time) * 1000, 2)
            return OCRParseResponse(
                locations=[],
                status="no_text_detected",
                processing_time_ms=elapsed_ms
            )

        # ── 4. Extract Coordinates (Priority: Request > EXIF GPS > Text Stamp) ─
        lat: Optional[float] = None
        lng: Optional[float] = None

        if request.latitude is not None and request.longitude is not None:
            lat = float(request.latitude)
            lng = float(request.longitude)
        elif coords_from_exif:
            lat, lng = coords_from_exif
        elif extracted_text:
            coord_match = cls.COORDINATES_REGEX.search(extracted_text)
            if coord_match:
                try:
                    lat = float(coord_match.group(1))
                    lng = float(coord_match.group(2))
                except (ValueError, IndexError):
                    lat, lng = None, None

        # ── 5. Parse Address Components ───────────────────────────────────────
        # A labeled Address field is more reliable than unrelated screen or invoice text.
        address_text = AddressValidator.extract_address_block(extracted_text)
        pincode = AddressValidator.extract_pincode(address_text)
        state = AddressValidator.extract_state(address_text)
        city = AddressValidator.extract_city(address_text)
        cleaned_street = AddressValidator.clean_street_address(address_text, city=city, state=state, pincode=pincode)

        # If pincode gives state and state was missing, infer state
        if pincode and not state:
            inferred_st = PINCODE_PREFIX_TO_STATE.get(pincode[:2])
            if inferred_st and inferred_st != "Northeast":
                state = inferred_st

        # If city gives state and state was missing, infer state
        if city and not state:
            inferred_st = MAJOR_CITIES.get(city.lower())
            if inferred_st:
                state = inferred_st


        # ── 6. Address Validation (Pincode & City/State Consistency) ───────────
        pincode_valid, city_state_consistent, conflict_warning = AddressValidator.validate_consistency(
            pincode=pincode,
            city=city,
            state=state
        )

        # Case: Text extracted but contains NO address components whatsoever
        if not address_text and lat is None:
            elapsed_ms = round((time.time() - start_time) * 1000, 2)
            return OCRParseResponse(
                locations=[],
                status="no_address_detected",
                processing_time_ms=elapsed_ms
            )

        # A city/state mention by itself is not a destination. Avoid returning a
        # plausible-looking but misleading city-centre pin for business copy.
        if not cleaned_street and not pincode and lat is None:
            elapsed_ms = round((time.time() - start_time) * 1000, 2)
            return OCRParseResponse(
                locations=[],
                status="no_address_detected",
                processing_time_ms=elapsed_ms
            )

        # ── 7. Geocoding (Full-Address Query - NEVER Geocode Only "Pune") ──────
        geocoded_point: Optional[GeoPoint] = None
        matched_address: Optional[str] = None
        geocode_verified = False

        if lat is not None and lng is not None:
            # We have exact coordinates (from GPS/EXIF): Reverse geocode
            rev_name = await get_geocoding_provider().reverse(lat, lng)
            if rev_name:
                matched_address = rev_name
                geocode_verified = True
            else:
                matched_address = f"{lat:.4f}, {lng:.4f}"

            geocoded_point = GeoPoint(
                lat=lat,
                lng=lng,
                address=matched_address,
                city=city,
                state=state,
                country="India"
            )
        else:
            # Construct a complete, structured search query:
            # [street/landmark], [city], [state], [pincode], India
            query_parts = []
            if cleaned_street:
                query_parts.append(cleaned_street)
            if city and city.lower() not in cleaned_street.lower():
                query_parts.append(city)
            if state and state.lower() not in cleaned_street.lower():
                query_parts.append(state)
            if pincode and pincode not in cleaned_street:
                query_parts.append(pincode)
            query_parts.append("India")

            full_query = ", ".join(query_parts)
            logger.info(f"Full address geocoding query: {full_query}")

            # Send full query to geocoder
            raw_points = await get_geocoding_provider().search(full_query, limit=1)
            points = [p for p in raw_points if cls._is_valid_indian_location(p)]

            # If full street query didn't match, attempt targeted query with [city], [state], [pincode]
            if not points and (city or pincode):
                fallback_parts = []
                if city:
                    fallback_parts.append(city)
                if state:
                    fallback_parts.append(state)
                if pincode:
                    fallback_parts.append(pincode)
                fallback_parts.append("India")
                fallback_query = ", ".join(fallback_parts)
                logger.info(f"Targeted area geocoding query: {fallback_query}")
                raw_fallback = await get_geocoding_provider().search(fallback_query, limit=1)
                points = [p for p in raw_fallback if cls._is_valid_indian_location(p)]


            if points:
                geocoded_point = points[0]
                matched_address = geocoded_point.address

                # Geocoder validation: Compare Geocoder output with OCR information
                is_geo_valid, geo_warning = AddressValidator.validate_geocoder_result(
                    ocr_city=city,
                    ocr_state=state,
                    ocr_pincode=pincode,
                    geocoded_point=geocoded_point
                )
                geocode_verified = is_geo_valid
                if geo_warning:
                    conflict_warning = f"{conflict_warning} {geo_warning}".strip() if conflict_warning else geo_warning
            else:
                # CRITICAL RULE: NEVER invent fake coordinates!
                geocoded_point = None
                matched_address = None
                geocode_verified = False

        # ── 8. Confidence Score Calculation ───────────────────────────────────
        final_confidence, confidence_breakdown = AddressValidator.calculate_confidence(
            ocr_confidence=ocr_confidence_raw,
            has_street_address=bool(cleaned_street),
            city=city,
            state=state,
            pincode_valid=pincode_valid,
            city_state_consistent=city_state_consistent,
            geocode_verified=geocode_verified,
            geocoded_point=geocoded_point
        )

        validation_details = ValidationDetails(
            pincode_valid=pincode_valid,
            city_state_consistent=city_state_consistent,
            geocode_verified=geocode_verified,
            conflict_warning=conflict_warning
        )

        # Cleaned display address
        display_address = cleaned_street or ""
        if not display_address:
            addr_parts = [p for p in [city, state, pincode] if p]
            display_address = ", ".join(addr_parts)

        elapsed_ms = round((time.time() - start_time) * 1000, 2)

        location_item = ParsedLocation(
            raw_extracted_text=extracted_text,
            cleaned_address=display_address,
            city=city,
            state=state,
            pincode=pincode,
            country="India",
            confidence_score=final_confidence,
            confidence_breakdown=confidence_breakdown,
            geocoded_point=geocoded_point,
            matched_address=matched_address,
            validation=validation_details
        )

        status = "success" if (geocoded_point and geocode_verified) else (
            "validation_conflict" if conflict_warning else (
                "geocoding_required" if not geocoded_point else "partial_match"
            )
        )

        return OCRParseResponse(
            locations=[location_item],
            status=status,
            processing_time_ms=elapsed_ms
        )

    # ── OCR Engine Execution ──────────────────────────────────────────────────

    @classmethod
    async def _execute_ocr_engine(cls, pil_img: Image.Image, raw_b64: str) -> Tuple[str, float]:
        """
        Executes OCR with multi-source failover:
        1. OCR.Space API (High-accuracy cloud document OCR)
        2. Local EasyOCR (Offline fallback)
        """
        # Try OCR.space if configured
        ocr_space_key = settings.OCR_SPACE_API_KEY
        if ocr_space_key:
            try:
                text = await cls._run_ocr_space_api(raw_b64, ocr_space_key)
                if text and len(text.strip()) > 5:
                    return (text.strip(), 0.95)
            except Exception as e:
                logger.warning(f"OCR.Space API call failed: {e}")

        # Fallback to Local EasyOCR
        try:
            local_text = await cls._run_local_easyocr(pil_img)
            if local_text and len(local_text.strip()) > 5:
                return (local_text.strip(), 0.88)
        except Exception as e:
            logger.warning(f"Local EasyOCR failed: {e}")

        return ("", 0.0)

    @classmethod
    async def _run_ocr_space_api(cls, raw_b64: str, api_key: str) -> str:
        """Calls OCR.Space API with image base64 data."""
        url = "https://api.ocr.space/parse/image"
        payload = {
            "apikey": api_key,
            "base64Image": f"data:image/jpeg;base64,{raw_b64}",
            "language": "eng",
            "isOverlayRequired": False,
            "detectOrientation": True,
            "scale": True,
            "OCREngine": 2,  # OCR Engine 2 is optimized for reading addresses and numbers
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, data=payload)
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("ParsedResults", [])
                if results and len(results) > 0:
                    parsed_text = results[0].get("ParsedText", "")
                    return parsed_text

        return ""

    @classmethod
    async def _run_local_easyocr(cls, pil_img: Image.Image) -> str:
        """Runs offline EasyOCR on contrast-enhanced PIL image."""
        reader = _get_easyocr_reader()
        if reader is None:
            return ""

        # Preprocessing: convert to greyscale + boost contrast/sharpness
        try:
            grey = pil_img.convert("L")
            grey = ImageEnhance.Contrast(grey).enhance(2.0)
            grey = ImageEnhance.Sharpness(grey).enhance(2.0)
            grey = grey.filter(ImageFilter.SHARPEN)
            proc_img = grey.convert("RGB")
        except Exception:
            proc_img = pil_img

        import numpy as np
        img_array = np.array(proc_img)

        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(
            None,
            lambda: reader.readtext(img_array, detail=0, paragraph=True),
        )
        return "\n".join(str(r) for r in results if r).strip()
