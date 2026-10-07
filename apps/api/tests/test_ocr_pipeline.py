import pytest
from fastapi.testclient import TestClient
from apps.api.app.main import app
from apps.api.app.engine.address_validator import AddressValidator

client = TestClient(app)


def test_pincode_repair_and_corruption_handling():
    # 'O' instead of '0'
    assert AddressValidator.clean_and_repair_pincode_candidate("411O45") == "411045"
    # 'l' instead of '1'
    assert AddressValidator.clean_and_repair_pincode_candidate("4ll045") == "411045"
    # 'S' instead of '5'
    assert AddressValidator.clean_and_repair_pincode_candidate("41104S") == "411045"
    # Spaced pin in text
    assert AddressValidator.extract_pincode("Deliver to Baner, Pune - 411 045") == "411045"
    # Labeled PIN with corruption
    assert AddressValidator.extract_pincode("PIN CODE: 560O66 Bangalore") == "560066"


def test_case_1_and_6_valid_address_and_consistency():
    """Case 1 & 6: Valid address with PIN, City, State consistency & coordinates."""
    payload = {
        "raw_text": "DELIVER TO: Rahul Sharma, Flat 402, Sai Residency, Baner Road, Pune, Maharashtra 411045"
    }
    response = client.post("/api/v1/ocr/parse-location", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["locations"]) == 1
    loc = data["locations"][0]

    assert loc["city"] == "Pune"
    assert loc["state"] == "Maharashtra"
    assert loc["pincode"] == "411045"
    assert loc["country"] == "India"
    assert loc["geocoded_point"] is not None
    assert loc["geocoded_point"]["lat"] > 0
    assert loc["geocoded_point"]["lng"] > 0
    assert loc["confidence_score"] >= 0.85
    assert loc["validation"]["pincode_valid"] is True
    assert loc["validation"]["city_state_consistent"] is True


def test_case_2_empty_or_no_text():
    """Case 2: Empty text or completely unreadable input."""
    payload = {"raw_text": "   "}
    response = client.post("/api/v1/ocr/parse-location", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "no_text_detected"
    assert len(data["locations"]) == 0


def test_case_3_text_without_address():
    """Case 3: OCR reads text but no address is detected."""
    payload = {
        "raw_text": "Retail Invoice #99812 Total Amount Rs 450. Thank you for your business!"
    }
    response = client.post("/api/v1/ocr/parse-location", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "no_address_detected"
    assert len(data["locations"]) == 0


def test_labeled_address_wins_over_unrelated_screen_text():
    """A screen capture can contain sample locations outside the actual Address field."""
    payload = {
        "raw_text": (
            "Photo Address & Map Scanner\n"
            "Office Name: Dy. Regional Transport Office, Nagpur (East)\n"
            "Address: N.I.T. Community Hall, Dipti Signal,\n"
            "Chikhali Layout, Nagpur - 440035\n"
            "Phone Number: 0712-2561698\n"
            "Pune Tech Corridor 411045\n"
            "Bengaluru Tech Park 560066"
        )
    }
    response = client.post("/api/v1/ocr/parse-location", json=payload)
    assert response.status_code == 200
    loc = response.json()["locations"][0]

    assert loc["cleaned_address"] == "N.I.T. Community Hall, Dipti Signal, Chikhali Layout, Nagpur - 440035"
    assert loc["city"] == "Nagpur"
    assert loc["state"] == "Maharashtra"
    assert loc["pincode"] == "440035"


def test_pin_anchored_address_ignores_map_screen_controls():
    payload = {
        "raw_text": (
            "Directions Save Nearby Send to phone Share\n"
            "post office, opp. Giripeth, Shantinagar Colony,\n"
            "Nagpur, Maharashtra 440001\n"
            "Located in: RTO Building, EAST, Kalamna\n"
            "Closed - Opens 11am Mon\n"
            "21.1509, 79.0782"
        )
    }
    response = client.post("/api/v1/ocr/parse-location", json=payload)
    assert response.status_code == 200
    loc = response.json()["locations"][0]

    assert loc["cleaned_address"] == "post office, opp. Giripeth, Shantinagar Colony, Nagpur, Maharashtra 440001"
    assert loc["city"] == "Nagpur"
    assert loc["state"] == "Maharashtra"
    assert loc["pincode"] == "440001"


def test_business_sign_extracts_only_physical_address_from_mixed_ocr_text():
    text = (
        "Akshay Wasule BUSINESS ASSOCIATE 096699265 SKY BLUE SOLAR ENERGY "
        "E-mail: skyblue.solarenergy@gmail.com, 20, Saibaba Nagar, "
        "Wathoda Layout, Nagpur-08, Mob.:"
    )
    address = AddressValidator.extract_address_block(text)
    assert address == "20, Saibaba Nagar, Wathoda Layout, Nagpur-08"
    assert "Wasule" not in address
    assert "solarenergy@gmail.com" not in address


def test_city_name_without_physical_address_is_not_geocoded_as_destination():
    response = client.post(
        "/api/v1/ocr/parse-location",
        json={"raw_text": "SKY BLUE SOLAR ENERGY, Nagpur, Maharashtra"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "no_address_detected"
    assert data["locations"] == []


def test_case_4_address_with_geocoding_failure_never_invents_coordinates():
    """
    Case 4: Non-existent fictitious place where geocoder returns no match.
    Must return geocoded_point: null and NEVER invent Pune or fake coordinates!
    """
    payload = {
        "raw_text": "Deliver to: Sector XZ99 Nonexistent Fantasy Land Colony, XYZUnknown 999999"
    }
    response = client.post("/api/v1/ocr/parse-location", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["locations"]) == 1
    loc = data["locations"][0]

    # Critical requirement: Never invent coordinates
    assert loc["geocoded_point"] is None
    assert loc["validation"]["geocode_verified"] is False
    assert loc["confidence_score"] < 0.70  # Low confidence


def test_case_5_city_pincode_state_conflict_detected():
    """
    Case 5: Mismatched Pincode and State (e.g., 400069 is Mumbai/MH, but state written as Karnataka).
    Validation must detect inconsistency.
    """
    pincode_valid, consistent, warning = AddressValidator.validate_consistency(
        pincode="400069",
        city="Mumbai",
        state="Karnataka"  # Conflict: Mumbai/400069 is in Maharashtra, not Karnataka
    )
    assert pincode_valid is True
    assert consistent is False
    assert warning is not None
    assert "Maharashtra" in warning
