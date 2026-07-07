"""Normalizacja i korekcja orientacji obrazu DR."""
from __future__ import annotations
import io
import math
from typing import Optional

import cv2
import numpy as np
from PIL import Image, ImageOps

MAX_LONG_SIDE = 4000  # px — ochrona pamięci


def exif_rotate(img: Image.Image) -> Image.Image:
    """Koryguje orientację EXIF (zdjęcia z telefonu)."""
    return ImageOps.exif_transpose(img)


def limit_size(img: Image.Image) -> Image.Image:
    """Przeskalowuje obraz tak, by najdłuższy bok nie przekraczał MAX_LONG_SIDE."""
    w, h = img.size
    longest = max(w, h)
    if longest <= MAX_LONG_SIDE:
        return img
    scale = MAX_LONG_SIDE / longest
    return img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)


def pil_to_cv2(img: Image.Image) -> np.ndarray:
    arr = np.array(img.convert("RGB"))
    return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)


def cv2_to_pil(arr: np.ndarray) -> Image.Image:
    rgb = cv2.cvtColor(arr, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)


def to_gray(arr: np.ndarray) -> np.ndarray:
    if len(arr.shape) == 2:
        return arr
    return cv2.cvtColor(arr, cv2.COLOR_BGR2GRAY)


def adaptive_threshold(gray: np.ndarray) -> np.ndarray:
    return cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 31, 11,
    )


def deskew_small_angle(gray: np.ndarray, max_angle: float = 15.0) -> np.ndarray:
    """
    Korekcja drobnego pochylenia (±max_angle°) przez minAreaRect na pikszelach tekstu.
    Zwraca prostowany obraz szarości.
    """
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    coords = np.column_stack(np.where(binary > 0))
    if len(coords) < 50:
        return gray
    rect = cv2.minAreaRect(coords)
    angle = rect[-1]
    # minAreaRect zwraca kąt w [-90, 0) — normalizujemy
    if angle < -45:
        angle = 90 + angle
    if abs(angle) > max_angle:
        return gray  # zbyt duży kąt — zostawiamy dla OSD
    h, w = gray.shape
    M = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    rotated = cv2.warpAffine(
        gray, M, (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=255,
    )
    return rotated


def osd_rotate_angle(pil_img: Image.Image) -> int:
    """
    Próbuje uzyskać kąt obrotu z Tesseract OSD.
    Zwraca 0/90/180/270 lub 0 jeśli OSD zawiedzie.
    """
    try:
        import pytesseract
        osd = pytesseract.image_to_osd(pil_img, config="--psm 0 -c min_characters_to_try=5")
        for line in osd.splitlines():
            if "Rotate:" in line:
                angle = int(line.split(":")[1].strip())
                return angle
    except Exception:
        pass
    return 0


def rotate_pil(img: Image.Image, angle: int) -> Image.Image:
    """Obraca PIL Image o angle stopni zgodnie z ruchem wskazówek zegara."""
    if angle == 0:
        return img
    return img.rotate(-angle, expand=True)


def find_document_quad(bgr: np.ndarray) -> Optional[np.ndarray]:
    """
    Wykrywa największy czworokąt (dokument) w obrazie.
    Zwraca macierz 4×2 narożników lub None.
    """
    gray = to_gray(bgr)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    kernel = np.ones((3, 3), np.uint8)
    dilated = cv2.dilate(edges, kernel, iterations=1)
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    img_area = bgr.shape[0] * bgr.shape[1]
    for cnt in contours[:5]:
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
        if len(approx) == 4 and cv2.contourArea(approx) > img_area * 0.1:
            return approx.reshape(4, 2).astype(np.float32)
    return None


def perspective_warp(bgr: np.ndarray, quad: np.ndarray) -> np.ndarray:
    """Prostuje perspektywę dokumentu do prostokąta."""
    # Porządkuj narożniki: tl, tr, br, bl
    s = quad.sum(axis=1)
    diff = np.diff(quad, axis=1)
    tl = quad[np.argmin(s)]
    br = quad[np.argmax(s)]
    tr = quad[np.argmin(diff)]
    bl = quad[np.argmax(diff)]
    pts_src = np.array([tl, tr, br, bl], dtype=np.float32)
    w = int(max(
        np.linalg.norm(br - bl),
        np.linalg.norm(tr - tl),
    ))
    h = int(max(
        np.linalg.norm(tr - br),
        np.linalg.norm(tl - bl),
    ))
    if w < 50 or h < 50:
        return bgr
    pts_dst = np.array([[0, 0], [w, 0], [w, h], [0, h]], dtype=np.float32)
    M = cv2.getPerspectiveTransform(pts_src, pts_dst)
    return cv2.warpPerspective(bgr, M, (w, h))


def load_images_from_bytes(data: bytes) -> list[Image.Image]:
    """
    Wczytuje bajty jako obraz(y).
    PDF → lista stron (dpi=300); JPG/PNG → lista z jednym elementem.
    Stosuje korekcję EXIF i limit rozmiaru.
    """
    # Wykrycie magic bytes
    magic = data[:8]
    is_pdf = magic[:4] == b'%PDF'

    images: list[Image.Image] = []
    if is_pdf:
        from pdf2image import convert_from_bytes
        pages = convert_from_bytes(data, dpi=300)
        for page in pages:
            page = exif_rotate(page)
            page = limit_size(page)
            images.append(page)
    else:
        img = Image.open(io.BytesIO(data))
        img = exif_rotate(img)
        img = limit_size(img)
        images.append(img.convert("RGB"))
    return images
