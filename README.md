# Apartaestudios Galerías · Web Masterplan 3D & Estudio de Mercado

[![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-success?style=flat-square&logo=github)](https://anasoficasca-code.github.io/ejercicio/)
[![Catastro Bogotá](https://img.shields.io/badge/Datos-Catastro%20Bogot%C3%A1%20UAECD-1e2a44?style=flat-square)](https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/catastro)
[![POT](https://img.shields.io/badge/Norma-POT%20Decreto%20555%2F2021-c8a46e?style=flat-square)](https://www.sdp.gov.co/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL%20PBR-black?style=flat-square&logo=three.js)](https://threejs.org/)

Masterplan 3D interactivo del **Ejercicio Profesional 2 · Estudio de mercado** de **JMC Arquitectura** (Ana Casas, Martín Jaramillo, Jorge): un edificio de **11 apartaestudios de 35 m²** en el **Lote 02 · Calle 56 # 17-53, esquina Carrera 18**, barrio **Galerías (Teusaquillo, Bogotá D.C.)**, modelado sobre el contexto urbano real de Catastro Bogotá.

La línea visual (panel lateral, tarjeta flotante, dock inferior, modales y estilo glassmorphism) es la misma del masterplan [Hotel Estelar La Fontana](https://github.com/alejagoguti-cpu/hotel-la-fontana-masterplan), con autorización de su autora.

---

## 📍 Ubicación y Georreferenciación

* **Coordenadas:** `4.6438909, -74.0692778` (centroide del lote catastral)
* **Dirección:** Calle 56 # 17-53, esquina Carrera 18 · Galerías, Teusaquillo · UPL 32
* **Lote catastral:** `007208002009` · Manzana `007208002`
* **Área de estudio:** Galerías, Alfonso López y Quesada · entre las Calles 53 y 60 y las Carreras 14 y 24

---

## 🗺️ Shapes y datos del contexto urbano

Todo el contexto sale de los servicios ArcGIS públicos de **Catastro Bogotá (UAECD)** con `scripts/build-context.py`, convertido a coordenadas locales en metros (origen = centroide del lote, X = este, Z = sur):

| Capa | Servicio Catastro | Uso en el masterplan |
| :--- | :--- | :--- |
| Construcciones | `catastro/construccion` | ~7.400 edificaciones con su número de pisos y altura real, fachadas de ladrillo, pañete o concreto con ventanas por piso y cubiertas con la ortofoto |
| Iglesia (lote `007208001002`) | `catastro/construccion` | Frente al lote sobre la Calle 56: nave reconstruida con cubierta a dos aguas y torre campanario con chapitel |
| Manzanas | `catastro/manzana` | Base de las manzanas y temas de color |
| Uso predominante | `catastro/usopredominante` | Tema **Usos del suelo** (residencial, comercio, dotacional…) |
| Altura media | `catastro/alturamedia` | Tema **Altura media** por manzana |
| Valor de referencia | `catastro/valorreferencia` | Tema **Valor del suelo** ($/m² de terreno por manzana) |
| Lotes | `catastro/lote` | Trama predial y los tres predios evaluados |
| Placas domiciliarias | `catastro/placadomiciliaria` | Geocodificación de servicios, competencia y lotes |

Ortofoto del suelo: Esri World Imagery. Mapa de "Dónde estamos": OpenStreetMap.

---

## 🏗️ Arquitectura de Carpetas del Repositorio

```text
ejercicio/
├── index.html                        # Punto de entrada HTML5 con import maps
├── README.md
│
├── data/
│   ├── proyecto.json                 # Todo el contenido del Canva: mercado, predios, matriz, norma, cabida, perfil
│   ├── puntos-fuente.json            # Servicios, competencia y lotes con su dirección (placa Catastro)
│   └── geometry/                     # Salida de scripts/build-context.py (coordenadas locales)
│       ├── construcciones.json       # Huellas + pisos + altura (Catastro)
│       ├── manzanas.json             # Manzanas con uso, altura media y valor de referencia
│       ├── lotes.json                # Trama predial alrededor del proyecto
│       ├── predios.json              # Lotes 01, 02 y 03 del análisis de predios
│       └── puntos.json               # Puntos de interés geocodificados
│
├── src/
│   ├── main.js                       # Orquestador de la aplicación
│   ├── geo.js                        # Georreferenciación y formatos (COP, distancias)
│   ├── state/store.js                # Estado reactivo (unidades, filtros, capas, vista)
│   ├── scene/
│   │   ├── MasterplanScene.js        # Motor Three.js: cielo con el sol real de Bogotá, sombras, cámara, raycasting
│   │   ├── CityContext.js            # Contexto Catastro, ortofoto, temas de color y área de estudio
│   │   ├── FacadeTextures.js         # Texturas de fachada (ladrillo, pañete, concreto, iglesia)
│   │   ├── Church.js                 # La iglesia frente al lote: nave, cubierta y torre
│   │   ├── ProjectBuilding.js        # Edificio de 6 pisos sobre todo el lote, 11 unidades seleccionables
│   │   └── PoiLayer.js               # Etiquetas 3D: servicios, competencia, predios y vías
│   ├── ui/
│   │   ├── SidebarFilters.js         # Panel izquierdo: apartaestudios por piso / capas urbanas
│   │   ├── UnitDetailCard.js         # Tarjeta flotante de la unidad (área, precio, acabados)
│   │   ├── BottomDock.js             # Dock: Dónde estamos, Urbanismo, Apartaestudios, Mercado, Predios, Galería
│   │   ├── MarketModal.js            # Estudio de mercado: 4 proyectos, comparativo $/m², perfil
│   │   ├── PrediosModal.js           # Predios, matriz de evaluación, norma del lote y cabida
│   │   ├── LocationModal.js          # Mapa OpenStreetMap con el área de estudio
│   │   ├── GalleryModal.js           # Visor de las 37 láminas del Canva
│   │   └── LoadingScreen.js
│   └── styles/masterplan.css
│
├── assets/
│   ├── canva/                        # Las 37 láminas del Canva "EJERCICIO PROFESIONAL 2"
│   ├── fotos/                        # Fotos de la competencia, los lotes y el apartaestudio
│   └── branding/                     # Logo JMC Arquitectura
│
└── scripts/
    └── build-context.py              # Descarga y procesa los shapes de Catastro Bogotá
```

---

## 🏢 Cabida arquitectónica · Lote 02

| Concepto | Valor |
| :--- | :--- |
| Lote (catastro) | 194,19 m² · esquinero, 18,64 m sobre la Calle 56 y 10,36 m sobre la Carrera 18 |
| Norma | Tratamiento de Conservación CO/3-4 · Proximidad generadora · antejardín 3,50 m · sin aislamiento posterior · no es BIC |
| Huella por piso | 104,49 m² (15,14 × 6,96 m) |
| Volumen | 6 pisos de 3,00 m · 18,00 m de altura |
| Área construida | 626,93 m² · IO 0,54 · IC 3,23 |
| Unidades | 11 apartaestudios de 35 m² · 384,60 m² vendibles |
| Precio de venta | $11.870.026,53 por m² |
| Ventas estimadas | $4.565.155.227 |

**Modelo 3D sobre todo el lote:** el edificio ocupa el polígono catastral completo (194 m² por piso, sin antejardín), con fachadas acristaladas a la Calle 56 y a la Carrera 18 y culatas de ladrillo contra los vecinos. La tabla de arriba es la cabida normativa del Canva.

| Piso | Esquina (Calle 56 con Carrera 18) | Centro | Medianero (Calle 56) |
| :--- | :--- | :--- | :--- |
| 1 | Lobby y bicicletero (~75 m²) | Punto fijo | Apartamento 101 (~75 m²) |
| 2 – 6 | Apartamento x01 (~75 m²) | Punto fijo | Apartamento x02 (~75 m²) |
| Cubierta | — | Sobrecubierta del ascensor | Terraza comunal con pérgola y BBQ |

Acabados del apartaestudio: laminado en roble claro, muros blanco hueso con cielo en drywall, cocina grafito con mesón de cuarzo blanco, baño en porcelanato gris de gran formato, ventanería y grifería negro mate, iluminación LED cálida.

---

## 📊 Estudio de mercado

| # | Proyecto | Dirección | Estrato | Constructora | Área prom. | Precio prom. | $/m² |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| 01 | Distrito KB | Carrera 24 # 45C-33 | 4 | AR | 32 m² | $703.249.000 | $15.956.473 |
| 02 | Kobe 50 | Calle 50 # 19-38 | 5 | CSB | 36 m² | $434.500.000 | $14.434.633 |
| 03 | Tikal 59 House | Transversal 24 con Calle 59 | 4 | DISICO | 63 m² | $559.240.000 | $13.066.358 |
| 05 | Proyecto Valé | — | 4 | DISICO | 27,9 – 37,6 m² | $277.605.000 – $374.120.000 | $9.950.000 |

> En la lámina 7 los datos de Valé repiten los de Tikal 59; la tabla usa los de la lámina 12.

---

## 🗂️ Análisis de predios

| Predio | Dirección | Área | Valor | $/m² de lote | Matriz |
| :--- | :--- | :---: | :---: | :---: | :---: |
| Lote 01 | Carrera 18 # 54-53 | 143,84 m² | $799.000.000 | $5.554.783 | — |
| **Lote 02 · seleccionado** | **Calle 56 # 17-53** | **194,19 m²** | **$870.000.000** | **$4.480.148** | **27 / 35** |
| Lote 03 | Carrera 15A # 60-44 | 160,84 m² | $860.000.000 | $5.346.929 | — |

Catastro da para la manzana del lote 02 un valor de referencia de **$4.430.000/m²**, muy cerca de los $4.480.148/m² del análisis.

---

## 🚀 Despliegue y Ejecución Local

No requiere instalación ni compilación. Se ejecuta con cualquier servidor estático:

```bash
# Opción 1: Con Python
python -m http.server 8080

# Opción 2: Con Node.js
npx serve .
```

Para volver a descargar el contexto de Catastro (por ejemplo con otro radio):

```bash
python3 scripts/build-context.py 700
```

Publicado en: `https://anasoficasca-code.github.io/ejercicio/`
