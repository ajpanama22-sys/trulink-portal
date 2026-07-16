// ===============================================
// Portal B2B Trulink Fiber
// Estilo visual: corporativo, elegante, premium
// Colores institucionales:
//   - Fondo negro (#000000)
//   - Acentos dorados (#d4af37)
//   - Tipografía blanca (#ffffff)
// Sensación: portal costoso, de alto nivel, con presencia
// ===============================================

// Landing Page:
// - Fondo negro sólido con degradados sutiles
// - Logo corporativo centrado (logo.png)
// - Tipografía moderna y elegante (ej. 'Montserrat' o 'Roboto')
// - Botones principales en dorado con hover en blanco:
//   1. Registro Cliente B2B
//   2. Registro Inversor Estratégico
//   3. Acceso con USER + PASS
// - Botones con bordes redondeados, sombra ligera,
//   transmitiendo exclusividad

// Formularios de Registro:
// - Campos con borde dorado y fondo negro
// - Etiquetas en blanco, texto en dorado al enfocar
// - Subida de documentos con estilo premium (botón dorado)
// - Al enviar → guardar en tabla `solicitudes_acceso` (Supabase)
//   tipo_solicitud = CLIENTE B2B o INVERSIONISTA ESTRATEGICO

// Portal de Administración:
// - Menú lateral en negro con íconos dorados
// - Sección VALIDAR: lista de registros con documentos adjuntos
//   → Botón dorado “Activar” envía correo con link (auth Supabase)
// - Sección COTIZACIONES: listado de PDFs generados con seguimiento
// - SMTP configurado con:
//   Servidor: smtp-relay.brevo.com
//   Puerto: 587
//   Usuario: b05854001@smtp-brevo.com
//   Clave: bsk0BBgjQ0GG5f3
//   Remitente: fred.jurado@trulinkfiber.com

// Portal de Clientes:
// - Opción Fábrica:
//   ASU: carretes 3km con 6/12/24/48 hilos
//   ADSS: carretes 3km con 72/96/144 hilos
//   FTTX: carretes 1km/3km con 1/2 hilos
//   → Carrito de compras dinámico (agregar/eliminar artículos)
//   → Cotización en pantalla con total y nota "PRECIOS EXW PANAMÁ"
//   → Guardar cotización → PDF con imágenes y especificaciones

// - Opción Productos Terminados:
//   Catálogo con imágenes (terminado.png, accesorios, herrajes)
//   → Carrito + PDF con imágenes y especificaciones

// Base de Datos (Supabase):
// - Tabla `quotes`:
//   id (PK), user_id, items (jsonb), total, status, type, created_at, tipo_carrete, hilos, pdf_url
// - Tabla `solicitudes_acceso`:
//   id (uuid), created_at, tipo_solicitud, razon_social, email, estado, documento_url, datos_completos (json)

// PDF de Cotización:
// - Encabezado con logo.png en dorado/negro
// - Tabla de productos con precios y cantidades
// - Nota: "Cotización válida por 15 días. Precio EXW Panamá"
// - Adjuntar imágenes y especificaciones como anexo

// Instrucciones para Copilot:
// - Generar componentes React/Next.js con estilo premium
// - Usar Supabase para auth y base de datos
// - Implementar subida de archivos y almacenamiento en Supabase Storage
// - Generar PDFs con librería (pdfkit o jsPDF) aplicando colores corporativos
// - Integrar SMTP para envío automático de cotizaciones y activaciones
// - Mantener consistencia visual con CSS variables globales:
//   :root {
//     --color-bg: #000000;
//     --color-gold: #d4af37;
//     --color-white: #ffffff;
//   }
// - Usar imágenes desde /public/images:
//   logo.png, ASU.png, ADSS.png, FTTX.png, terminado.png, fabrica.png
