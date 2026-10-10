from typing import Literal

from pydantic import BaseModel, Field

Level = Literal["rendah", "sedang", "tinggi"]


class CostRequest(BaseModel):
    """Masukan tingkat-musim. Nilai pilihan harus sama persis dengan dataset latih."""

    komoditas: Literal["cabai", "tomat", "bawang"]
    luas_ha: float = Field(gt=0, le=5)
    jenis_tanah: Literal["Lempung", "Lempung berpasir", "Liat", "Pasir", "Tanah vulkanik (andosol)"]
    sumber_air: Literal["Embung atau sungai", "Irigasi teknis", "Sumur atau pompa", "Tadah hujan"]
    provinsi: Literal["Jawa Barat", "Jawa Tengah", "Jawa Timur", "Sulawesi Selatan", "Sumatera Utara"]
    bulan_tanam: int = Field(ge=1, le=12)
    hujan_mm_rata_per_minggu: float = Field(ge=0, le=500)
    minggu_hujan_lebat: int = Field(ge=0, le=20)
    suhu_maks_rata: float = Field(ge=10, le=50)
    ph: float = Field(ge=3, le=9)
    fosfor: Level
    nitrogen: Level
    kalium: Level
    indeks_harga_pupuk: float = Field(ge=50, le=200)
    indeks_upah: float = Field(ge=50, le=200)
    indeks_harga_pestisida: float = Field(ge=50, le=200)


class LeafRequest(BaseModel):
    image_base64: str = Field(min_length=100)