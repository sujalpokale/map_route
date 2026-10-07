"""
Address Validator and Indian Postal Intelligence Engine
Provides robust extraction, validation, normalization, and consistency verification
for Indian shipping labels, delivery invoices, and waybills.
"""

import re
from typing import Dict, List, Optional, Tuple
from apps.api.app.schemas import ValidationDetails, ConfidenceBreakdown, GeoPoint

# ── 1. Indian States & Union Territories ──────────────────────────────────────
INDIAN_STATES_MAP: Dict[str, str] = {
    # Full names
    "andhra pradesh": "Andhra Pradesh",
    "arunachal pradesh": "Arunachal Pradesh",
    "assam": "Assam",
    "bihar": "Bihar",
    "chhattisgarh": "Chhattisgarh",
    "goa": "Goa",
    "gujarat": "Gujarat",
    "haryana": "Haryana",
    "himachal pradesh": "Himachal Pradesh",
    "jharkhand": "Jharkhand",
    "karnataka": "Karnataka",
    "kerala": "Kerala",
    "madhya pradesh": "Madhya Pradesh",
    "maharashtra": "Maharashtra",
    "manipur": "Manipur",
    "meghalaya": "Meghalaya",
    "mizoram": "Mizoram",
    "nagaland": "Nagaland",
    "odisha": "Odisha",
    "orissa": "Odisha",
    "punjab": "Punjab",
    "rajasthan": "Rajasthan",
    "sikkim": "Sikkim",
    "tamil nadu": "Tamil Nadu",
    "telangana": "Telangana",
    "tripura": "Tripura",
    "uttar pradesh": "Uttar Pradesh",
    "uttarakhand": "Uttarakhand",
    "west bengal": "West Bengal",
    # Union Territories
    "delhi": "Delhi",
    "new delhi": "Delhi",
    "national capital territory of delhi": "Delhi",
    "chandigarh": "Chandigarh",
    "puducherry": "Puducherry",
    "pondicherry": "Puducherry",
    "jammu and kashmir": "Jammu and Kashmir",
    "jammu & kashmir": "Jammu and Kashmir",
    "ladakh": "Ladakh",
    "andaman and nicobar": "Andaman and Nicobar Islands",
    "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
    "daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
}

# Common state abbreviations used in Indian waybills
STATE_ABBREVIATIONS: Dict[str, str] = {
    "MH": "Maharashtra",
    "KA": "Karnataka",
    "DL": "Delhi",
    "TN": "Tamil Nadu",
    "TS": "Telangana",
    "TG": "Telangana",
    "AP": "Andhra Pradesh",
    "GJ": "Gujarat",
    "UP": "Uttar Pradesh",
    "RJ": "Rajasthan",
    "WB": "West Bengal",
    "MP": "Madhya Pradesh",
    "HR": "Haryana",
    "PB": "Punjab",
    "KL": "Kerala",
    "BR": "Bihar",
    "JH": "Jharkhand",
    "OR": "Odisha",
    "OD": "Odisha",
    "GA": "Goa",
    "UK": "Uttarakhand",
    "UA": "Uttarakhand",
    "AS": "Assam",
    "CH": "Chandigarh",
}

# ── 2. Major Indian Cities & Corresponding States ──────────────────────────────
MAJOR_CITIES: Dict[str, str] = {
    # Maharashtra
    "pune": "Maharashtra",
    "mumbai": "Maharashtra",
    "navi mumbai": "Maharashtra",
    "thane": "Maharashtra",
    "pimpri-chinchwad": "Maharashtra",
    "pimpri": "Maharashtra",
    "chinchwad": "Maharashtra",
    "nagpur": "Maharashtra",
    "nashik": "Maharashtra",
    "aurangabad": "Maharashtra",
    "chhatrapati sambhaji nagar": "Maharashtra",
    "solapur": "Maharashtra",
    "kolhapur": "Maharashtra",
    "amravati": "Maharashtra",
    "nanded": "Maharashtra",
    "sangli": "Maharashtra",
    "jalgaon": "Maharashtra",
    "akola": "Maharashtra",
    "latur": "Maharashtra",
    "dhule": "Maharashtra",
    "ahmednagar": "Maharashtra",
    "chandrapur": "Maharashtra",
    "parbhani": "Maharashtra",
    "panvel": "Maharashtra",
    "kalyan": "Maharashtra",
    "dombivli": "Maharashtra",
    "vasai": "Maharashtra",
    "virar": "Maharashtra",
    "mira-bhayandar": "Maharashtra",
    "bhiwandi": "Maharashtra",
    "satara": "Maharashtra",

    # Karnataka
    "bengaluru": "Karnataka",
    "bangalore": "Karnataka",
    "mysuru": "Karnataka",
    "mysore": "Karnataka",
    "hubballi": "Karnataka",
    "hubli": "Karnataka",
    "dharwad": "Karnataka",
    "mangaluru": "Karnataka",
    "mangalore": "Karnataka",
    "belagavi": "Karnataka",
    "belgaum": "Karnataka",
    "kalaburagi": "Karnataka",
    "gulbarga": "Karnataka",
    "ballari": "Karnataka",
    "bellary": "Karnataka",
    "davangere": "Karnataka",
    "shivamogga": "Karnataka",
    "shimoga": "Karnataka",
    "tumakuru": "Karnataka",
    "tumkur": "Karnataka",
    "udupi": "Karnataka",

    # Delhi / NCR
    "delhi": "Delhi",
    "new delhi": "Delhi",
    "noida": "Uttar Pradesh",
    "greater noida": "Uttar Pradesh",
    "ghaziabad": "Uttar Pradesh",
    "gurugram": "Haryana",
    "gurgaon": "Haryana",
    "faridabad": "Haryana",

    # Telangana & Andhra Pradesh
    "hyderabad": "Telangana",
    "secunderabad": "Telangana",
    "warangal": "Telangana",
    "nizamabad": "Telangana",
    "karimnagar": "Telangana",
    "khammam": "Telangana",
    "visakhapatnam": "Andhra Pradesh",
    "vizag": "Andhra Pradesh",
    "vijayawada": "Andhra Pradesh",
    "guntur": "Andhra Pradesh",
    "nellore": "Andhra Pradesh",
    "kurnool": "Andhra Pradesh",
    "rajahmundry": "Andhra Pradesh",
    "tirupati": "Andhra Pradesh",
    "kakinada": "Andhra Pradesh",

    # Tamil Nadu
    "chennai": "Tamil Nadu",
    "coimbatore": "Tamil Nadu",
    "madurai": "Tamil Nadu",
    "tiruchirappalli": "Tamil Nadu",
    "trichy": "Tamil Nadu",
    "salem": "Tamil Nadu",
    "tirunelveli": "Tamil Nadu",
    "tiruppur": "Tamil Nadu",
    "vellore": "Tamil Nadu",
    "erode": "Tamil Nadu",
    "thoothukudi": "Tamil Nadu",

    # Gujarat
    "ahmedabad": "Gujarat",
    "surat": "Gujarat",
    "vadodara": "Gujarat",
    "baroda": "Gujarat",
    "rajkot": "Gujarat",
    "bhavnagar": "Gujarat",
    "jamnagar": "Gujarat",
    "gandhinagar": "Gujarat",
    "junagadh": "Gujarat",
    "anand": "Gujarat",
    "vapi": "Gujarat",

    # West Bengal
    "kolkata": "West Bengal",
    "howrah": "West Bengal",
    "durgapur": "West Bengal",
    "asansol": "West Bengal",
    "siliguri": "West Bengal",

    # Rajasthan
    "jaipur": "Rajasthan",
    "jodhpur": "Rajasthan",
    "kota": "Rajasthan",
    "bikaner": "Rajasthan",
    "ajmer": "Rajasthan",
    "udaipur": "Rajasthan",
    "bhilwara": "Rajasthan",
    "alwar": "Rajasthan",

    # Uttar Pradesh
    "lucknow": "Uttar Pradesh",
    "kanpur": "Uttar Pradesh",
    "varanasi": "Uttar Pradesh",
    "banaras": "Uttar Pradesh",
    "agra": "Uttar Pradesh",
    "prayagraj": "Uttar Pradesh",
    "allahabad": "Uttar Pradesh",
    "meerut": "Uttar Pradesh",
    "bareilly": "Uttar Pradesh",
    "aligarh": "Uttar Pradesh",
    "moradabad": "Uttar Pradesh",
    "gorakhpur": "Uttar Pradesh",
    "mathura": "Uttar Pradesh",

    # Madhya Pradesh
    "indore": "Madhya Pradesh",
    "bhopal": "Madhya Pradesh",
    "jabalpur": "Madhya Pradesh",
    "gwalior": "Madhya Pradesh",
    "ujjain": "Madhya Pradesh",

    # Kerala
    "kochi": "Kerala",
    "cochin": "Kerala",
    "thiruvananthapuram": "Kerala",
    "trivandrum": "Kerala",
    "kozhikode": "Kerala",
    "calicut": "Kerala",
    "thrissur": "Kerala",
    "kollam": "Kerala",
    "kannur": "Kerala",

    # Punjab & Chandigarh
    "chandigarh": "Chandigarh",
    "ludhiana": "Punjab",
    "amritsar": "Punjab",
    "jalandhar": "Punjab",
    "patiala": "Punjab",
    "bathinda": "Punjab",

    # Bihar & Jharkhand
    "patna": "Bihar",
    "gaya": "Bihar",
    "bhagalpur": "Bihar",
    "muzaffarpur": "Bihar",
    "ranchi": "Jharkhand",
    "jamshedpur": "Jharkhand",
    "dhanbad": "Jharkhand",
    "bokaro": "Jharkhand",

    # Odisha
    "bhubaneswar": "Odisha",
    "cuttack": "Odisha",
    "rourkela": "Odisha",

    # Goa
    "panaji": "Goa",
    "margao": "Goa",
    "vasco da gama": "Goa",
}

# ── 3. Indian PIN Code Prefix to State Mapping ────────────────────────────────
# In India, the first 2 digits of a 6-digit PIN code define the postal circle/state.
PINCODE_PREFIX_TO_STATE: Dict[str, str] = {
    "11": "Delhi",
    "12": "Haryana",
    "13": "Haryana",
    "14": "Punjab",
    "15": "Punjab",
    "16": "Chandigarh",
    "17": "Himachal Pradesh",
    "18": "Jammu and Kashmir",
    "19": "Jammu and Kashmir",
    "20": "Uttar Pradesh",
    "21": "Uttar Pradesh",
    "22": "Uttar Pradesh",
    "23": "Uttar Pradesh",
    "24": "Uttarakhand",
    "25": "Uttar Pradesh",
    "26": "Uttar Pradesh",
    "27": "Uttar Pradesh",
    "28": "Uttar Pradesh",
    "30": "Rajasthan",
    "31": "Rajasthan",
    "32": "Rajasthan",
    "33": "Rajasthan",
    "34": "Rajasthan",
    "36": "Gujarat",
    "37": "Gujarat",
    "38": "Gujarat",
    "39": "Gujarat",
    "40": "Maharashtra",
    "41": "Maharashtra",
    "42": "Maharashtra",
    "43": "Maharashtra",
    "44": "Maharashtra",
    "45": "Madhya Pradesh",
    "46": "Madhya Pradesh",
    "47": "Madhya Pradesh",
    "48": "Madhya Pradesh",
    "49": "Chhattisgarh",
    "50": "Telangana",
    "51": "Andhra Pradesh",
    "52": "Andhra Pradesh",
    "53": "Andhra Pradesh",
    "56": "Karnataka",
    "57": "Karnataka",
    "58": "Karnataka",
    "59": "Karnataka",
    "60": "Tamil Nadu",
    "61": "Tamil Nadu",
    "62": "Tamil Nadu",
    "63": "Tamil Nadu",
    "64": "Tamil Nadu",
    "67": "Kerala",
    "68": "Kerala",
    "69": "Kerala",
    "70": "West Bengal",
    "71": "West Bengal",
    "72": "West Bengal",
    "73": "West Bengal",
    "74": "West Bengal",
    "75": "Odisha",
    "76": "Odisha",
    "77": "Odisha",
    "78": "Assam",
    "79": "Northeast",  # Meghalaya, Mizoram, Tripura, Arunachal, Manipur, Nagaland
    "80": "Bihar",
    "81": "Bihar",
    "82": "Jharkhand",
    "83": "Jharkhand",
    "84": "Bihar",
    "85": "Bihar",
}

# Key 3-digit prefixes for major metropolitan hubs
CITY_PINCODE_PREFIXES: Dict[str, List[str]] = {
    "pune": ["411", "412"],
    "mumbai": ["400"],
    "navi mumbai": ["4007"],
    "thane": ["4006"],
    "nagpur": ["440", "441"],
    "nashik": ["422"],
    "bengaluru": ["560", "562"],
    "bangalore": ["560", "562"],
    "mysuru": ["570"],
    "delhi": ["110"],
    "new delhi": ["110"],
    "noida": ["2013"],
    "ghaziabad": ["2010"],
    "gurugram": ["122"],
    "gurgaon": ["122"],
    "faridabad": ["121"],
    "hyderabad": ["500"],
    "secunderabad": ["500"],
    "chennai": ["600"],
    "coimbatore": ["641"],
    "ahmedabad": ["380"],
    "surat": ["395"],
    "vadodara": ["390"],
    "kolkata": ["700"],
    "jaipur": ["302"],
    "lucknow": ["226"],
    "kanpur": ["208"],
    "indore": ["452"],
    "bhopal": ["462"],
    "kochi": ["682"],
    "thiruvananthapuram": ["695"],
    "chandigarh": ["160"],
    "patna": ["800"],
}


class AddressValidator:
    """
    Deterministic Indian Postal and Address Validator.
    Never invents fake addresses or default cities.
    """

    @classmethod
    def clean_and_repair_pincode_candidate(cls, candidate: str) -> Optional[str]:
        """
        Repairs common OCR optical corruptions in a 6-character postal string.
        e.g., '411O45' -> '411045'
              '4ll045' -> '411045'
              '41104S' -> '411045'
              '411 045' -> '411045'
        """
        if not candidate:
            return None

        # Remove spaces and dashes
        s = re.sub(r"[\s\-_]+", "", candidate.strip())
        if len(s) != 6:
            return None

        # Map common letter corruptions to digits
        char_map = {
            "O": "0", "o": "0", "D": "0", "Q": "0",
            "I": "1", "l": "1", "|": "1", "!": "1",
            "Z": "2", "z": "2",
            "E": "3",
            "A": "4",
            "S": "5", "s": "5", "$": "5",
            "G": "6", "b": "6",
            "T": "7",
            "B": "8",
            "g": "9", "q": "9",
        }

        repaired_chars = []
        for ch in s:
            if ch.isdigit():
                repaired_chars.append(ch)
            elif ch in char_map:
                repaired_chars.append(char_map[ch])
            else:
                return None  # Unrepairable character

        repaired = "".join(repaired_chars)
        # Indian PIN must start with 1-9 and be 6 digits
        if re.match(r"^[1-9][0-9]{5}$", repaired):
            return repaired

        return None

    @classmethod
    def extract_pincode(cls, text: str) -> Optional[str]:
        """
        Extracts and verifies a 6-digit Indian PIN code from raw text,
        accounting for corruptions and spacing patterns.
        """
        if not text:
            return None

        # 1. First look for labeled PIN patterns: PIN: 411045, Pincode - 411 045, etc.
        labeled_match = re.search(
            r"(?:pin|pincode|postal(?:\s*code)?|pin\s*code)\s*[:\-#]?\s*([0-9A-Za-z]{6}|[0-9A-Za-z]{3}\s+[0-9A-Za-z]{3})",
            text,
            re.IGNORECASE
        )
        if labeled_match:
            candidate = labeled_match.group(1).strip()
            repaired = cls.clean_and_repair_pincode_candidate(candidate)
            if repaired:
                return repaired

        # 2. Look for spaced 6-digit PIN: '411 045'
        spaced_match = re.search(r"\b([1-9][0-9]{2})\s+([0-9]{3})\b", text)
        if spaced_match:
            candidate = spaced_match.group(1) + spaced_match.group(2)
            if re.match(r"^[1-9][0-9]{5}$", candidate):
                return candidate

        # 3. Look for standard 6-digit numbers starting with 1-9
        # (avoid matching 10-digit mobile numbers)
        for m in re.finditer(r"\b([1-9][0-9]{5})\b", text):
            span_start, span_end = m.span()
            # Ensure not part of longer digit string like phone number
            is_phone_continuation = (
                (span_start > 0 and text[span_start - 1].isdigit()) or
                (span_end < len(text) and text[span_end].isdigit())
            )
            if not is_phone_continuation:
                return m.group(1)

        # 4. Look for corrupt candidates (e.g., 411O45) surrounded by word boundaries
        corrupt_candidates = re.findall(r"\b([1-9A-Za-z]{6})\b", text)
        for cand in corrupt_candidates:
            # Must have at least 4 digits to be a plausible PIN candidate
            digit_count = sum(1 for c in cand if c.isdigit())
            if digit_count >= 4:
                repaired = cls.clean_and_repair_pincode_candidate(cand)
                if repaired:
                    return repaired

        return None

    @classmethod
    def extract_address_block(cls, text: str) -> str:
        """Returns a labeled address, or the address lines surrounding a PIN code."""
        if not text:
            return ""

        lines = [re.sub(r"^[^A-Za-z0-9]+", "", line).strip() for line in text.splitlines()]
        def normalize(parts: List[str]) -> str:
            address = ", ".join(part.strip(" ,.-") for part in parts if part.strip(" ,.-"))
            address = address.rstrip(" @•·")
            # Screen OCR commonly leaves a one-letter icon label after a PIN code.
            return re.sub(r"(\b[1-9][0-9]{5})\s+[A-Za-z]\b", r"\1", address)

        stop_pattern = re.compile(
            r"\b(?:office\s*name|phone(?:\s*number)?|mobile|tel|email|contact|"
            r"take\s*photo|choose\s*(?:gallery|another\s*image)|retake\s*photo|"
            r"edit\s*address|awaiting\s*input|street\s*address|sample\s*waybills?|"
            r"directions|save|nearby|send\s*to|share|located\s*in|closed|opens?)\b",
            re.IGNORECASE,
        )

        for index, line in enumerate(lines):
            match = re.search(r"\b(?:delivery\s+)?address\s*[:\-]\s*(.+)", line, re.IGNORECASE)
            if not match:
                continue

            parts = [match.group(1).strip()]
            for continuation in lines[index + 1:]:
                if not continuation or stop_pattern.search(continuation):
                    break
                parts.append(continuation)

            return normalize(parts)

        # Map and directory screenshots often show an address without an "Address:" label.
        # The PIN line is a reliable anchor; collect only the contiguous address lines before it.
        for index, line in enumerate(lines):
            if not cls.extract_pincode(line):
                continue

            parts = [line]
            for previous in reversed(lines[max(0, index - 2):index]):
                if not previous or stop_pattern.search(previous):
                    break
                parts.insert(0, previous)
            return normalize(parts)

        # Business signs often have no "Address:" label or PIN code. Find a
        # physical-address anchor (house number + locality/road keyword) and
        # discard the surrounding company, phone, and email copy.
        flat_text = re.sub(r"\s+", " ", text).strip()
        address_anchor = re.compile(
            r"\b\d{1,5}\s*,?\s+(?:[A-Z0-9][\w.-]*\s+){0,5}"
            r"(?:nagar|layout|road|rd|street|st|lane|marg|colony|"
            r"sector|phase|plot|cross|circle|chowk|nagar|peth|"
            r"residency|heights|tower|society|vihar|industrial\s+area)\b",
            re.IGNORECASE,
        )
        anchor = address_anchor.search(flat_text)
        if anchor:
            candidate = flat_text[anchor.start():]
            candidate = re.split(
                r"\b(?:mob(?:ile)?|phone|tel|contact|e-mail|email|website|"
                r"business\s+associate|closed|opens?)\b\s*[:.]?",
                candidate,
                maxsplit=1,
                flags=re.IGNORECASE,
            )[0]
            return normalize([candidate])

        return ""


    @classmethod
    def extract_state(cls, text: str) -> Optional[str]:
        """Extracts recognized Indian State from text."""
        if not text:
            return None

        # Look for full state names (longer names first to avoid partial matches)
        sorted_states = sorted(INDIAN_STATES_MAP.items(), key=lambda x: len(x[0]), reverse=True)
        for state_lower, canon_name in sorted_states:
            pattern = rf"\b{re.escape(state_lower)}\b"
            if re.search(pattern, text, re.IGNORECASE):
                return canon_name

        # Look for standalone state abbreviations in address context
        for abbr, canon_name in STATE_ABBREVIATIONS.items():
            pattern = rf"(?:,\s*|\s+){abbr}(?:[\s,.\-]|\s*-\s*\d|$)"
            if re.search(pattern, text):
                return canon_name

        return None

    @classmethod
    def extract_city(cls, text: str) -> Optional[str]:
        """Extracts recognized Indian City from text."""
        if not text:
            return None

        # Sort cities by length descending (e.g. Navi Mumbai before Mumbai, Greater Noida before Noida)
        sorted_cities = sorted(MAJOR_CITIES.items(), key=lambda x: len(x[0]), reverse=True)
        for city_lower, _ in sorted_cities:
            pattern = rf"\b{re.escape(city_lower)}\b"
            if re.search(pattern, text, re.IGNORECASE):
                # Return proper capitalized name
                return " ".join(word.capitalize() for word in city_lower.split())

        return None

    @classmethod
    def validate_pincode_format(cls, pincode: Optional[str]) -> bool:
        """Validates that a string is a valid 6-digit Indian PIN code."""
        if not pincode:
            return False
        return bool(re.match(r"^[1-9][0-9]{5}$", pincode.strip()))

    @classmethod
    def validate_consistency(
        cls,
        pincode: Optional[str],
        city: Optional[str],
        state: Optional[str]
    ) -> Tuple[bool, bool, Optional[str]]:
        """
        Validates consistency between Pincode, City, and State.
        Returns:
          (pincode_valid, city_state_consistent, conflict_warning)
        """
        pincode_valid = cls.validate_pincode_format(pincode)
        city_state_consistent = True
        warnings: List[str] = []

        expected_state_from_pin: Optional[str] = None
        if pincode_valid and pincode:
            prefix_2 = pincode[:2]
            expected_state_from_pin = PINCODE_PREFIX_TO_STATE.get(prefix_2)

            # Check PIN vs State consistency
            if expected_state_from_pin and state:
                if state.lower() != expected_state_from_pin.lower():
                    # Special case for Goa/MH overlap (403 is Goa, 400-402 is MH)
                    if prefix_2 == "40" and pincode.startswith("403") and state.lower() == "goa":
                        pass
                    # Special case for UK/UP overlap (24 is Uttarakhand, 20-28 is UP)
                    elif prefix_2 == "24" and state.lower() in ["uttarakhand", "uttar pradesh"]:
                        pass
                    # Special case for Northeast
                    elif expected_state_from_pin == "Northeast" and state in [
                        "Meghalaya", "Mizoram", "Tripura", "Arunachal Pradesh", "Manipur", "Nagaland"
                    ]:
                        pass
                    else:
                        city_state_consistent = False
                        warnings.append(
                            f"Pincode {pincode} belongs to {expected_state_from_pin}, but detected state is {state}."
                        )

            # Check PIN vs City consistency
            if city:
                city_lower = city.lower()
                expected_city_prefixes = CITY_PINCODE_PREFIXES.get(city_lower)
                if expected_city_prefixes:
                    matches_city_prefix = any(pincode.startswith(pref) for pref in expected_city_prefixes)
                    if not matches_city_prefix:
                        # Pincode prefix does not match known prefix for this major city
                        city_state_consistent = False
                        warnings.append(
                            f"Pincode {pincode} does not match typical prefix for city {city}."
                        )

        # Check City vs State consistency
        if city and state:
            city_lower = city.lower()
            expected_state_from_city = MAJOR_CITIES.get(city_lower)
            if expected_state_from_city:
                if expected_state_from_city.lower() != state.lower():
                    city_state_consistent = False
                    warnings.append(
                        f"City {city} is in {expected_state_from_city}, but detected state is {state}."
                    )

        conflict_warning = " ".join(warnings) if warnings else None
        return (pincode_valid, city_state_consistent, conflict_warning)

    @classmethod
    def validate_geocoder_result(
        cls,
        ocr_city: Optional[str],
        ocr_state: Optional[str],
        ocr_pincode: Optional[str],
        geocoded_point: Optional[GeoPoint]
    ) -> Tuple[bool, Optional[str]]:
        """
        Compares geocoder response with OCR extracted information.
        Flags conflicts where geocoder returns an entirely different city/state/pincode.
        """
        if not geocoded_point:
            return (False, "Geocoding returned no coordinates.")

        conflicts: List[str] = []

        # Compare City
        if ocr_city and geocoded_point.city:
            geo_city = geocoded_point.city.lower()
            ocr_c = ocr_city.lower()
            # If neither contains the other (e.g. Pune vs Mumbai)
            if ocr_c not in geo_city and geo_city not in ocr_c:
                # Exclude sub-district or twin city equivalencies (e.g. Pimpri-Chinchwad & Pune)
                is_twin = (
                    ("pune" in ocr_c and "pimpri" in geo_city) or
                    ("pimpri" in ocr_c and "pune" in geo_city) or
                    ("mumbai" in ocr_c and "thane" in geo_city) or
                    ("delhi" in ocr_c and "noida" in geo_city)
                )
                if not is_twin:
                    conflicts.append(f"City mismatch (Detected: {ocr_city}, Geocoder: {geocoded_point.city})")

        # Compare State
        if ocr_state and geocoded_point.state:
            geo_state = geocoded_point.state.lower()
            ocr_s = ocr_state.lower()
            if ocr_s not in geo_state and geo_state not in ocr_s:
                conflicts.append(f"State mismatch (Detected: {ocr_state}, Geocoder: {geocoded_point.state})")

        # Check address string for pincode if available
        if ocr_pincode and geocoded_point.address:
            geo_pin_match = re.search(r"\b([1-9][0-9]{5})\b", geocoded_point.address)
            if geo_pin_match:
                geo_pin = geo_pin_match.group(1)
                if geo_pin != ocr_pincode:
                    # If first 2 digits differ, they are in entirely different regions
                    if geo_pin[:2] != ocr_pincode[:2]:
                        conflicts.append(f"Postal code mismatch (Detected: {ocr_pincode}, Geocoder: {geo_pin})")

        if conflicts:
            conflict_msg = (
                f"Address verification required. Detected: "
                f"{ocr_city or 'Unknown'}, {ocr_state or 'Unknown'} - {ocr_pincode or 'N/A'}. "
                f"Geocoder: {geocoded_point.city or 'Unknown'}, {geocoded_point.state or 'Unknown'}."
            )
            return (False, conflict_msg)

        return (True, None)

    @classmethod
    def clean_street_address(cls, text: str, city: Optional[str] = None, state: Optional[str] = None, pincode: Optional[str] = None) -> str:
        """
        Strips label metadata, phone numbers, tracking numbers, and noise
        to isolate the core physical street, building, and landmark address.
        """
        if not text:
            return ""

        # Remove header/label identifiers
        t = re.sub(
            r"(?:deliver to|ship to|consignee|recipient|address|invoice|waybill|awb|order id|tracking id|consignment no)[\s:#\-_]*",
            "",
            text,
            flags=re.IGNORECASE
        )
        # Remove phone/mobile numbers (10 digits with common prefixes)
        t = re.sub(r"\b(?:ph|tel|mob|phone|mobile|contact)[\s:#\-_]*\+?(?:91[\s\-]?)?\d{10}\b", "", t, flags=re.IGNORECASE)
        t = re.sub(r"\b[6-9]\d{9}\b", "", t)  # Raw 10-digit Indian mobile numbers
        # Remove package weight / dimensions / price / GST metadata
        t = re.sub(r"(?:package|weight|pkg|wt|gross wt|vol)[\s:#\-_]*\d+(?:\.\d+)?\s*(?:kg|gms|g|lbs)\b", "", t, flags=re.IGNORECASE)
        t = re.sub(r"(?:rs|inr|amt|total)[\s.:#]*\d+(?:\.\d+)?", "", t, flags=re.IGNORECASE)
        t = re.sub(r"(?:gstin|gst no|pan)[\s:#\-_]*[0-9A-Z]{10,15}", "", t, flags=re.IGNORECASE)

        # Normalize line endings to commas
        t = re.sub(r"[\r\n]+", ", ", t)
        # Normalize redundant spaces, dashes, commas
        t = re.sub(r"[,;\s]+,", ",", t)
        t = re.sub(r"\s+", " ", t).strip(" ,.-")

        # If no city, state, or pincode was detected, check if text has any address/landmark keywords.
        # If it's merely receipt/invoice noise (e.g. 'Retail #99812. Thank you for your business!'), return empty.
        if not city and not state and not pincode:
            has_addr_marker = bool(re.search(
                r"\b(?:road|rd|street|st|lane|marg|nagar|layout|sector|sec|plot|flat|apt|apartment|"
                r"bldg|building|floor|flr|block|phase|chowk|peth|opp|opposite|near|nr|behind|bh|"
                r"bypass|highway|hwy|cross|circle|enclave|residency|heights|tower|park|complex|"
                r"industrial|midc|hub|depot|colony|society|soc|vihar|villa|arcade|plaza|estate)\b",
                text,
                re.IGNORECASE
            ))
            if not has_addr_marker:
                return ""

        return t[:180]


    @classmethod
    def calculate_confidence(
        cls,
        ocr_confidence: float,
        has_street_address: bool,
        city: Optional[str],
        state: Optional[str],
        pincode_valid: bool,
        city_state_consistent: bool,
        geocode_verified: bool,
        geocoded_point: Optional[GeoPoint]
    ) -> Tuple[float, ConfidenceBreakdown]:
        """
        Calculates separate sub-scores and final weighted location confidence score.
        Thresholds:
          >= 0.95: Very High (Verified)
          0.85 - 0.94: High (Review recommended)
          0.70 - 0.84: Medium (User confirmation required)
          < 0.70: Low (Do not automatically accept)
        """
        # 1. OCR Confidence
        ocr_conf = max(0.1, min(1.0, ocr_confidence))

        # 2. Address Parsing Confidence
        components_found = sum([
            1 if has_street_address else 0,
            1 if city else 0,
            1 if state else 0,
            1 if pincode_valid else 0,
        ])
        parsing_conf = components_found / 4.0

        # 3. Pincode Confidence
        if pincode_valid and city_state_consistent:
            pincode_conf = 1.0
        elif pincode_valid:
            pincode_conf = 0.6
        else:
            pincode_conf = 0.0

        # 4. Geocoding Confidence
        if geocoded_point is not None and geocode_verified:
            geocoding_conf = 0.95
        elif geocoded_point is not None:
            geocoding_conf = 0.60
        else:
            geocoding_conf = 0.0

        # 5. Consistency Confidence
        if city_state_consistent and geocode_verified:
            consistency_conf = 1.0
        elif city_state_consistent:
            consistency_conf = 0.70
        else:
            consistency_conf = 0.25

        # Weighted Composite Score
        # OCR (20%) + Parsing (20%) + Pincode (20%) + Geocoding (25%) + Consistency (15%)
        final_score = (
            0.20 * ocr_conf +
            0.20 * parsing_conf +
            0.20 * pincode_conf +
            0.25 * geocoding_conf +
            0.15 * consistency_conf
        )

        final_score = round(max(0.0, min(1.0, final_score)), 2)

        breakdown = ConfidenceBreakdown(
            ocr_confidence=round(ocr_conf, 2),
            parsing_confidence=round(parsing_conf, 2),
            pincode_confidence=round(pincode_conf, 2),
            geocoding_confidence=round(geocoding_conf, 2),
            consistency_confidence=round(consistency_conf, 2),
        )

        return (final_score, breakdown)
