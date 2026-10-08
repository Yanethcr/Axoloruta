# Axolo-Ruta — Ciudad de México

La identidad visual de Axolo-Ruta usa vino, crema, rosa y verde inspirados en el logo. La imagen original está en `frontend/public/axolo-ruta-logo.jpeg` y aparece en el login y en la cabecera del mapa. Si el archivo falta, se muestra un monograma temporal. Los colores del mapa incrustado son administrados por Open Charge Map.

## Ejecutar

1. Instala las dependencias con `pnpm install`.
2. Copia `backend/.env.example` a `backend/.env`.
3. Registra tu aplicación en Open Charge Map (Mi perfil → Mis aplicaciones) y coloca tu clave en `OCM_API_KEY`.
4. Ejecuta `pnpm dev` desde la raíz y abre http://localhost:3000.

La clave se usa únicamente en el backend. Reinicia el backend después de cambiar `.env`.

## Mapa y datos

El mapa interactivo oficial se carga mediante un iframe y se centra al elegir una zona o usar tu ubicación. Funciona independientemente de la clave del backend y de la carga de la lista. Requiere Internet. La geolocalización requiere localhost o HTTPS y permiso del navegador.

La vista de consulta muestra mapa amplio y lista lateral en computadora, y permite alternar Mapa/Lista en celular. La búsqueda de lugares se realiza únicamente desde el buscador del mapa de Open Charge Map. Puedes filtrar carga DC en la lista, cargar más resultados y centrar el mapa en una estación desde su ficha. Las distancias son en línea recta. El botón de pantalla completa depende del navegador; también puedes abrir el mapa en otra pestaña. Los filtros de la app afectan la lista; el mapa oficial conserva sus propios filtros y sus búsquedas no sincronizan la lista lateral.

La lista consulta `/api/ocm`, que obtiene estaciones de `https://api.openchargemap.io/v3/poi` dentro de una caja que abarca las 16 alcaldías de CDMX (puede incluir puntos colindantes). Incluye dirección, operador, conectores, potencia, costo y estado reportado cuando la fuente los proporciona. El backend mantiene una caché de un minuto y reutiliza datos guardados si la consulta falla.

El menú incluye las 16 alcaldías y centra el mapa, sin recortar estaciones por límites administrativos. Los filtros del auto empiezan desactivados para no ocultar resultados.

Sin `OCM_API_KEY`, la lista usa OpenStreetMap; con `OCM_DEMO=true` y sin clave muestra ejemplos identificados. La fuente aparece junto al conteo. Los filtros del auto solo afectan la lista; el mapa oficial tiene sus propios filtros y puede mostrar otras estaciones.

Los estados reportados no garantizan disponibilidad en tiempo real. Los datos de Open Charge Map tienen licencias según su proveedor; consulta la ficha original para su atribución específica.

Documentación oficial: https://www.openchargemap.org/develop y https://www.openchargemap.org/develop/api.

## Login y mapa

La raíz abre `/login`. Registro e inicio de sesión llevan a `/mapa`. El mapa verifica la sesión antes de cargar su contenido y `/api/ocm` exige una sesión válida. `/cuenta` redirige a login para conservar enlaces anteriores.

Las cuentas y sesiones persisten en `backend/data/app.sqlite` con Node.js 24. Las contraseñas usan scrypt y sal aleatoria, las cookies son HttpOnly y las sesiones duran siete días. Conserva la base para no perder cuentas. Configura `APP_URL` con el origen del frontend; en producción las cookies requieren HTTPS. No incluye verificación de correo ni recuperación de contraseña.

La app muestra los costos informativos que proporcione el operador en Open Charge Map. No calcula cotizaciones ni procesa cobros.

Validación: `pnpm build` y `node backend/tests/account.test.cjs`.

## Disponibilidad simulada de hubs

Cada ficha de electrolinera muestra un conteo de hubs **libres y ocupados**, marcado como simulado y calculado para los puntos de carga mostrados. Al abrir los puntos se ve el estado simulado individual, consistente con el conteo. Los estados cambian automáticamente cada 30 segundos mientras la pantalla está abierta. `/simulador` conserva una vista independiente con cuatro hubs ficticios.

Los estados se generan en el frontend y no se obtienen de Open Charge Map, OCPP, WebSockets ni hardware. Los nombres y puntos de las fichas siguen procediendo del catálogo de estaciones; su ocupación es ficticia. No representa la disponibilidad real. Al recargar se restablece el escenario inicial. La pantalla solo permite consultar los estados; no tiene controles de carga, cobros ni mensajes técnicos.

