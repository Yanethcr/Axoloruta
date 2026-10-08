# Axolo-Ruta: aplicación de consulta de electrolineras

## Descripción de la aplicación

Axolo-Ruta es una aplicación web orientada a facilitar la consulta de estaciones de carga para vehículos eléctricos en la Ciudad de México. Su propósito es reunir en una misma interfaz la ubicación de las electrolineras, sus conectores, la potencia reportada y datos informativos del operador. La aplicación también incorpora una demostración de disponibilidad de puntos de carga, identificada como simulación.

El prototipo utiliza el nombre y el logotipo del proyecto, con una identidad visual basada en tonos vino, crema, rosa y verde. El diseño se adapta a computadoras y teléfonos: en pantallas amplias presenta un mapa con una lista lateral de estaciones, mientras que en dispositivos móviles permite alternar entre las vistas de mapa y lista.

## Registro, inicio de sesión y bienvenida

Para acceder a la página principal, el usuario puede crear una cuenta con nombre, correo electrónico y contraseña, o iniciar sesión con una cuenta existente. Las cuentas y sesiones se conservan en una base de datos local del servidor. Las contraseñas se almacenan mediante una función de derivación scrypt con una sal aleatoria; la sesión se mantiene mediante una cookie HttpOnly.

Después de iniciar sesión o crear una cuenta, se muestra una pantalla de bienvenida con el logotipo flotante de Axolo-Ruta y un saludo personalizado. Tras aproximadamente dos segundos, la aplicación abre automáticamente la página principal con el mapa. El usuario también puede cerrar su sesión desde esta pantalla principal.

## Consulta del mapa y estaciones

La aplicación integra el mapa interactivo oficial de Open Charge Map mediante un iframe, siguiendo su documentación de integración [2]. La búsqueda de lugares se realiza mediante el buscador de ese mapa. Como accesos adicionales, el usuario puede elegir entre las 16 alcaldías de la Ciudad de México o utilizar su ubicación, si concede permiso al navegador, para centrar la vista.

La lista de electrolineras se obtiene desde el backend mediante la API de Open Charge Map cuando está configurada la clave de acceso [1]. Sin dicha clave, existe una fuente alternativa de OpenStreetMap, consultada mediante Overpass API [3]. La consulta abarca una zona rectangular que contiene las alcaldías de CDMX y puede incluir estaciones colindantes; no representa un recorte exacto por límites administrativos.

Cada ficha presenta, cuando la fuente proporciona los datos, el nombre de la estación, dirección, operador, conectores, potencia, costo informativo y estado reportado. La lista se ordena por distancia en línea recta respecto de la ubicación de referencia. Desde la ficha se puede centrar el mapa en la estación y abrir indicaciones para llegar en Google Maps. El mapa también puede consultarse en pantalla completa o en otra pestaña.

El mapa incrustado y la lista lateral funcionan de manera independiente: las búsquedas realizadas dentro de Open Charge Map no actualizan automáticamente la lista de la aplicación. Los filtros de la lista tampoco modifican los resultados del mapa oficial.

## Selección del vehículo y estimación del tiempo de carga

El usuario puede seleccionar un modelo de vehículo y su porcentaje actual de batería. Con estos datos, la aplicación ofrece una estimación del tiempo necesario para alcanzar el 80 % de carga, cuando conoce la potencia y el tipo de corriente del punto.

La estimación considera la capacidad de batería del vehículo y la menor potencia entre la que proporciona el cargador y la que admite el automóvil en corriente alterna o directa. Supone una potencia constante; el tiempo real puede variar por temperatura, estado de la batería y reducción de potencia durante la carga. Los datos del catálogo de vehículos son aproximados.

La lista permite filtrar puntos de carga DC y comparar el tipo de corriente admitido por el automóvil. Este filtro no verifica la compatibilidad física del conector; el usuario debe comprobarla antes de acudir a la estación. El porcentaje de batería sirve para la estimación de tiempo, sin modificar la disponibilidad de los puntos.

## Disponibilidad simulada de hubs

Cada electrolinera muestra un conteo de hubs libres y ocupados, calculado para los puntos de carga que aparecen en su ficha. Los estados se distinguen con etiquetas y colores: verde para libre y rojo para ocupado. Al desplegar los puntos de carga se observa el estado individual correspondiente al conteo.

La ocupación se genera mediante datos simulados en el frontend y cambia automáticamente cada 30 segundos mientras la pantalla permanece abierta. Todas las fichas identifican estos valores como simulados. No se obtienen de Open Charge Map ni de sensores, equipos físicos o conexiones OCPP, y no representan disponibilidad real. Al recargar la aplicación se restablece el escenario inicial.

Esta función permite demostrar cómo el usuario consultaría la disponibilidad de puntos de carga dentro del prototipo. Actualmente no permite reservar, activar o detener cargadores. Para sustituir la simulación por disponibilidad real, se requiere una integración autorizada con los operadores de las estaciones.

## Arquitectura tecnológica

El frontend está desarrollado con Next.js, React y TypeScript. El backend utiliza NestJS y TypeScript, y gestiona las cuentas, las sesiones y la consulta de estaciones. La persistencia de cuentas se realiza con SQLite en el servidor, bajo Node.js 24.

La clave de Open Charge Map permanece en el backend. Las consultas de estaciones utilizan una caché temporal para reducir solicitudes repetidas; si una actualización falla, el backend puede devolver la última información disponible. El mapa oficial se integra mediante un iframe.

## Alcance actual del prototipo

Axolo-Ruta permite registrarse, iniciar sesión, consultar electrolineras, revisar sus puntos de carga y visualizar una demostración de disponibilidad. Muestra costos únicamente como información publicada por el operador cuando está disponible; no calcula una tarifa final ni procesa pagos con tarjeta.

El prototipo no incluye reservas, control de hardware, confirmación de disponibilidad real, recuperación de contraseñas ni verificación del correo. Los datos reportados por las fuentes externas pueden estar desactualizados. La simulación está separada de esos datos para evitar presentar una ocupación ficticia como información real.

## Validación realizada

Durante el desarrollo se verificaron las compilaciones de frontend y backend y se ejecutaron pruebas de registro, sesión persistente, cierre de sesión, protección de la API y alcance de la consulta de estaciones. También se comprobó que el logotipo se sirve correctamente como imagen pública. Estas verificaciones corresponden al prototipo y no equivalen a una validación de disponibilidad de estaciones o funcionamiento de cargadores físicos.

## Origen de los datos

Open Charge Map: fuente principal de ubicaciones y datos de estaciones. El backend consulta el recurso de puntos de interés (POI) mediante GET en https://api.openchargemap.io/v3/poi/ . De esta respuesta se toman la dirección, coordenadas, operador, conectores, potencia y, cuando se incluyen, costos informativos y estado reportado [1]. El costo publicado no constituye una cotización automática ni un cálculo con el Precio Marginal Local del CENACE.

Mapa oficial: la aplicación incrusta https://map.openchargemap.io/ . Su buscador y resultados pertenecen al servicio de Open Charge Map y funcionan independientemente de la lista lateral [2].

OpenStreetMap y Overpass API: fuente alternativa cuando no está configurada la clave de Open Charge Map. El backend consulta elementos con la etiqueta amenity=charging_station y toma las coordenadas y etiquetas disponibles. Utiliza los servicios https://overpass-api.de/api/interpreter y https://maps.mail.ru/osm/tools/overpass/api/interpreter . Overpass permite consultar datos de OpenStreetMap por ubicación y etiquetas [3]. Los datos de OpenStreetMap se distribuyen bajo la licencia Open Database License (ODbL) y requieren atribución [4].

Datos propios del prototipo: los conteos de hubs libres y ocupados se generan localmente mediante una simulación. El catálogo de vehículos es una configuración interna con valores aproximados, y los tiempos de carga son cálculos de la aplicación; no provienen de una API de disponibilidad ni de mediciones de una sesión real. La ubicación del usuario se obtiene del navegador con su permiso.

La documentación de Open Charge Map indica que sus datos pueden proceder de contribuciones de usuarios o de proveedores externos con distintas condiciones de licencia. Debe conservarse la atribución correspondiente a la fuente y al proveedor cuando se identifica [2].

## Referencias

[1] Open Charge Map. (s. f.). API Documentation. Documentación de la API utilizada para consultar puntos de carga. https://www.openchargemap.org/develop/api

[2] Open Charge Map. (s. f.). Developing with Open Charge Map. Integración del mapa mediante iframe, fuentes de datos y condiciones de atribución. https://www.openchargemap.org/develop

[3] OpenStreetMap Wiki. (s. f.). Overpass API. Documentación de consultas de datos de OpenStreetMap por ubicación y etiquetas. https://wiki.openstreetmap.org/wiki/Overpass_API

[4] OpenStreetMap. (s. f.). Copyright and License. Licencia ODbL y requisitos de atribución de los datos. https://www.openstreetmap.org/copyright

Referencias consultadas el 8 de octubre de 2026.
