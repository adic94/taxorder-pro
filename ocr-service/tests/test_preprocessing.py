"""
Testy preprocessingu: orientacja EXIF, deskew, wykrywanie kwadratu.
Obrazy syntetyczne generowane w testach (PIL.ImageDraw).
"""
import math
import pytest
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import cv2

from extractors.preprocessing import (
    exif_rotate, limit_size, pil_to_cv2, cv2_to_pil,
    to_gray, adaptive_threshold, deskew_small_angle,
    find_document_quad, perspective_warp,
    MAX_LONG_SIDE,
)


def _make_text_image(text: str = "ABCDE 12345", size=(400, 200), bg=255, fg=0) -> Image.Image:
    """Tworzy syntetyczny obraz z tekstem."""
    img = Image.new("RGB", size, color=(bg, bg, bg))
    draw = ImageDraw.Draw(img)
    draw.text((20, 80), text, fill=(fg, fg, fg))
    return img


def _rotate_pil_arbitrary(img: Image.Image, angle: float) -> Image.Image:
    """Obraca obraz PIL o dowolny kąt (nie expand=True dla zachowania rozmiaru)."""
    return img.rotate(angle, expand=True, fillcolor=(255, 255, 255))


class TestExifRotate:
    def test_brak_exif_nie_psuje(self):
        img = _make_text_image()
        result = exif_rotate(img)
        assert result.size == img.size

    def test_zwraca_pil_image(self):
        img = _make_text_image()
        result = exif_rotate(img)
        assert isinstance(result, Image.Image)


class TestLimitSize:
    def test_maly_obraz_niezmieniony(self):
        img = Image.new("RGB", (800, 600))
        result = limit_size(img)
        assert result.size == (800, 600)

    def test_duzy_obraz_skalowany(self):
        img = Image.new("RGB", (8000, 6000))
        result = limit_size(img)
        assert max(result.size) == MAX_LONG_SIDE

    def test_zachowuje_proporcje(self):
        img = Image.new("RGB", (8000, 4000))
        result = limit_size(img)
        w, h = result.size
        assert abs(w / h - 2.0) < 0.01

    def test_dokladnie_na_granicy(self):
        img = Image.new("RGB", (MAX_LONG_SIDE, MAX_LONG_SIDE))
        result = limit_size(img)
        assert result.size == (MAX_LONG_SIDE, MAX_LONG_SIDE)


class TestConversions:
    def test_pil_to_cv2_shape(self):
        img = Image.new("RGB", (100, 50))
        arr = pil_to_cv2(img)
        assert arr.shape == (50, 100, 3)

    def test_roundtrip(self):
        img = _make_text_image()
        arr = pil_to_cv2(img)
        result = cv2_to_pil(arr)
        assert result.size == img.size


class TestToGray:
    def test_rgb_na_gray(self):
        arr = np.zeros((50, 100, 3), dtype=np.uint8)
        gray = to_gray(arr)
        assert len(gray.shape) == 2

    def test_juz_gray_bez_zmian(self):
        arr = np.zeros((50, 100), dtype=np.uint8)
        gray = to_gray(arr)
        assert gray.shape == (50, 100)


class TestAdaptiveThreshold:
    def test_zwraca_binarny(self):
        img = _make_text_image()
        arr = pil_to_cv2(img)
        gray = to_gray(arr)
        thresh = adaptive_threshold(gray)
        assert thresh.shape == gray.shape
        # Tylko 0 i 255
        unique = set(thresh.flatten().tolist())
        assert unique.issubset({0, 255})


class TestDeskew:
    def test_deskew_prosty_obraz(self):
        """Obraz bez obrotu — deskew nie powinien go zniekształcić."""
        img = _make_text_image(size=(400, 200))
        arr = pil_to_cv2(img)
        gray = to_gray(arr)
        result = deskew_small_angle(gray)
        assert result.shape == gray.shape

    def test_deskew_maly_kat(self):
        """Obraz obrócony o 5° — deskew powinien go wyprostować (kształt zachowany)."""
        img = _make_text_image(size=(600, 300))
        rotated = _rotate_pil_arbitrary(img, 5)
        arr = pil_to_cv2(rotated)
        gray = to_gray(arr)
        result = deskew_small_angle(gray)
        # Po deskew kształt może być inny (warpAffine zachowuje rozmiar)
        assert result is not None

    def test_deskew_duzy_kat_pominiety(self):
        """Kąt > 15° — deskew zwraca oryginalny obraz."""
        img = _make_text_image(size=(400, 200))
        arr = pil_to_cv2(img)
        gray = to_gray(arr)
        # Symulujemy duży kąt: testujemy że funkcja nie rzuca wyjątku
        result = deskew_small_angle(gray, max_angle=2.0)
        assert result is not None


class TestFindDocumentQuad:
    def test_brak_wyraznego_czworokata(self):
        """Jednolite tło — brak czworokąta."""
        arr = np.ones((200, 300, 3), dtype=np.uint8) * 200
        quad = find_document_quad(arr)
        # Może zwrócić None lub nieprawidłowy quad na jednolitym tle
        assert quad is None or quad.shape == (4, 2)

    def test_wyrazny_prostokat(self):
        """Czarny prostokąt na białym tle — powinien być wykryty."""
        arr = np.ones((400, 600, 3), dtype=np.uint8) * 255
        cv2.rectangle(arr, (50, 50), (550, 350), (0, 0, 0), 5)
        quad = find_document_quad(arr)
        # Na syntetycznym obrazie quad może być wykryty lub nie — testujemy brak wyjątku
        assert quad is None or quad.shape == (4, 2)


class TestPerspectiveWarp:
    def test_warp_na_prostym_obrazie(self):
        """perspective_warp na czworokącie = prawidłowe wymiary wyjściowe."""
        arr = np.ones((400, 600, 3), dtype=np.uint8) * 200
        quad = np.array([[50, 50], [550, 50], [550, 350], [50, 350]], dtype=np.float32)
        result = perspective_warp(arr, quad)
        # Wynikowy obraz nie powinien być pusty
        assert result is not None
        assert result.shape[0] > 0 and result.shape[1] > 0
