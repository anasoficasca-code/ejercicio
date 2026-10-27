/**
 * Georreferenciación de la escena. Origen (0, 0) = centroide del lote 007208002009
 * (Calle 56 # 17-53, esquina Carrera 18). X = este, Z = sur (−Z = norte), unidades en metros.
 * Es la misma conversión que usa scripts/build-context.py para los datos de Catastro.
 */
export const LON0 = -74.0692778;
export const LAT0 = 4.6438909;
export const MLON = 110945;
export const MLAT = 110574;

export const toLocal = (lon, lat) => [(lon - LON0) * MLON, -(lat - LAT0) * MLAT];
export const toLonLat = (x, z) => [LON0 + x / MLON, LAT0 - z / MLAT];

/** Distancia en metros entre dos puntos [lon, lat]. */
export function distanceM(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const fmtDist = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`);

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
export const fmtCOP = (v) => cop.format(v).replace(/\s/g, ' ');
export const fmtMillones = (v) => `$${(v / 1e6).toFixed(1).replace('.', ',')} M`;
export const fmtNum = (v, d = 2) => v.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
