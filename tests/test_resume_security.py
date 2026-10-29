"""
Acorn Resume Security & Provider-Independent Storage Tests
==========================================================
Milestone: BETA-02 — Personalized User Profiles, Scan Isolation & Portable Data Architecture
Verifies that:
  1. Valid PDF (%PDF-) and DOCX (PK..) magic byte signatures are accepted.
  2. Fake files (e.g. text file renamed to .pdf) are strictly rejected.
  3. Oversized files (>5MB) are rejected.
  4. LocalPrivateResumeStorage puts, gets, checks existence, and deletes safely.
  5. Local adapter resists directory traversal.
"""

import tempfile
from pathlib import Path
import pytest

from src.acorn.domain.storage import (
    LocalPrivateResumeStorage,
    CloudflareR2ResumeStorage,
    ResumeSecurityValidator,
    ResumeValidationError,
    PDF_MAGIC_BYTES,
    DOCX_MAGIC_BYTES,
)


def test_resume_validator_valid_pdf():
    valid_pdf_content = PDF_MAGIC_BYTES + b"1.7\n%Fake PDF binary stream for testing\n%%EOF"
    content_type, checksum = ResumeSecurityValidator.validate_document("my_resume.pdf", valid_pdf_content)

    assert content_type == "application/pdf"
    assert len(checksum) == 64


def test_resume_validator_valid_docx():
    valid_docx_content = DOCX_MAGIC_BYTES + b"\x00\x00Fake DOCX zip stream content"
    content_type, checksum = ResumeSecurityValidator.validate_document("my_resume.docx", valid_docx_content)

    assert content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    assert len(checksum) == 64


def test_resume_validator_rejects_renamed_fake_pdf():
    fake_content = b"This is just plain ASCII text pretending to be a PDF"
    with pytest.raises(ResumeValidationError, match="lacks valid %PDF- signature"):
        ResumeSecurityValidator.validate_document("fake.pdf", fake_content)


def test_resume_validator_rejects_oversized_document():
    large_content = PDF_MAGIC_BYTES + b"0" * (6 * 1024 * 1024)  # 6MB
    with pytest.raises(ResumeValidationError, match="exceeds maximum allowable limit of 5MB"):
        ResumeSecurityValidator.validate_document("huge.pdf", large_content)


def test_local_private_resume_storage_lifecycle():
    with tempfile.TemporaryDirectory() as tmpdir:
        storage = LocalPrivateResumeStorage(tmpdir)
        test_key = "usr_123_resume.pdf"
        test_data = PDF_MAGIC_BYTES + b"test data"

        # 1. Put
        meta = storage.put_object(test_key, test_data, "application/pdf")
        assert meta.key == test_key
        assert meta.file_size == len(test_data)
        assert storage.exists(test_key)

        # 2. Get
        retrieved = storage.get_object(test_key)
        assert retrieved == test_data

        # 3. Traversal defense
        traversal_key = "../../secret.txt"
        storage.put_object(traversal_key, b"safe", "text/plain")
        assert (Path(tmpdir) / "secret.txt").exists()

        # 4. Delete
        assert storage.delete_object(test_key)
        assert not storage.exists(test_key)


def test_cloudflare_r2_storage_interface_contract():
    r2 = CloudflareR2ResumeStorage(bucket_name="acorn-test-bucket")
    test_key = "usr_r2_doc.pdf"
    test_data = PDF_MAGIC_BYTES + b"r2 data"

    meta = r2.put_object(test_key, test_data, "application/pdf")
    assert meta.storage_provider == "cloudflare_r2"
    assert r2.exists(test_key)
    assert r2.get_object(test_key) == test_data
    assert r2.delete_object(test_key)
    assert not r2.exists(test_key)
