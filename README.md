# Plato Justo

App web para decidir qué pedir en un restaurante sin salirte de tu plan de porciones.
Funciona en el celular, se instala en la pantalla de inicio y abre sin barra del navegador.

**Costo total: cero.** El hosting es gratis y la lectura del menú va con el plan gratuito
de la API de Gemini, que no pide tarjeta.

## Qué hay en esta carpeta

```
public/index.html          la app completa, un solo archivo
public/manifest.webmanifest lo que hace que se instale como app
public/icon-180/192/512.png el icono
src/index.js                enruta /api/analizar hacia worker.js; todo lo demás lo sirve Cloudflare solo
src/worker.js                la función que guarda tu llave y llama a Gemini
worker.js                    copia idéntica de src/worker.js, para la ruta B (se pega directo en el editor)
wrangler.jsonc                la configuración que Cloudflare necesita para desplegar todo junto
```

## Paso 1: la llave de Gemini

1. Entra a `aistudio.google.com`, inicia sesión con tu cuenta de Google y busca **Get API key**.
2. Crea la llave. No pide tarjeta.
3. Esa llave **nunca** va en el sitio. Va en una función de servidor, que es lo que hace `worker.js`.
4. Inventa además una **clave de app**: cualquier contraseña. La app te la va a pedir una vez y
   evita que alguien que encuentre la dirección de tu función se coma tu límite gratis.

El plan gratuito tiene un tope de peticiones al día. Para ocho o diez comidas fuera al mes ni te
le acercas, pero tenlo presente: si un día sale el aviso de límite, puedes escribir el platillo a
mano o esperar al día siguiente. Los límites exactos de tu cuenta se ven en el panel de AI Studio.

Una cosa que conviene saber: en el plan gratuito, Google puede usar lo que envías para mejorar sus
modelos. Para la foto de un menú público probablemente no te importe, pero es la diferencia real
contra pagar unos centavos por una API que no lo hace.

---

## Paso 2, ruta A: todo junto con Cloudflare (recomendada)

Sigues usando GitHub igual que siempre. Cloudflare lee tu repo y publica el sitio **y**
la función juntos, en un solo dominio. Nota: Cloudflare unificó Pages y Workers en un
solo flujo de "Connect to Git" que ya no pide framework/build command, sino un archivo
`wrangler.jsonc` — por eso esta carpeta ya lo trae listo, no tienes que escribir nada.

1. Sube esta carpeta completa a un repo de GitHub (con las subcarpetas `public/` y `src/`,
   y el archivo `wrangler.jsonc` en la raíz — no lo dejes fuera).
2. Entra a `dash.cloudflare.com`, crea cuenta gratis y ve a **Workers & Pages → Create application**.
3. Conecta tu repo de GitHub. Cloudflare va a detectar `wrangler.jsonc` solo y va a mostrar
   un **Deploy command** ya puesto en `npx wrangler deploy` — no lo cambies, es correcto.
4. Antes de darle a Deploy, agrega las variables: en **Settings → Variables and Secrets**
   (o en la pantalla de configuración antes de desplegar, si te la ofrece ahí):
   - `GEMINI_API_KEY` = tu llave de Google AI Studio (márcala como Secret)
   - `CLAVE_APP` = la contraseña que inventaste
5. Despliega. Te queda una dirección tipo `https://plato-justo.TUCUENTA.workers.dev`
   (ya no dice `.pages.dev`, dice `.workers.dev` — es lo mismo, solo cambió el nombre).
6. Abre esa dirección en el celular, entra a **Tu cuenta → Conexión**, deja la dirección
   del servidor **vacía** y escribe tu clave de app. Toca Guardar y probar.

Si en el paso 3 el campo de Deploy command aparece vacío o distinto a `npx wrangler deploy`,
es que `wrangler.jsonc` no llegó a la raíz del repo — revisa que esté junto a `public/` y `src/`,
no dentro de alguna de esas carpetas.

## Paso 2, ruta B: el sitio en GitHub Pages y la función aparte

GitHub Pages no corre código de servidor, así que la llave no puede vivir ahí.
El sitio va en GitHub Pages y la función va aparte, pegada directo en el editor de Cloudflare
(sin pasar por Git, así que este archivo `wrangler.jsonc` no aplica en esta ruta).

**El sitio**

1. Sube esta carpeta a un repo de GitHub.
2. En **Settings → Pages**, elige la rama `main` y la carpeta `/public` como raíz.
3. Te queda una dirección tipo `https://tuusuario.github.io/plato-justo`.

**La función**

4. En `dash.cloudflare.com`, ve a **Workers & Pages → Create application → Start with Hello World**,
   ponle un nombre como `plato-justo` y créalo.
5. Abre el editor del Worker, borra lo que trae y pega **todo el contenido de `worker.js`**
   (el archivo suelto en la raíz de esta carpeta, no el de `src/`).
6. En **Settings → Variables and Secrets** del Worker, agrega:
   - `GEMINI_API_KEY` = tu llave de Google AI Studio (Secret)
   - `CLAVE_APP` = la contraseña que inventaste
   - `ORIGEN_PERMITIDO` = `https://tuusuario.github.io`
7. Despliega. Te queda una dirección tipo `https://plato-justo.TUCUENTA.workers.dev`.
8. Abre el sitio en el celular, entra a **Tu cuenta → Conexión**, pega ahí la dirección
   del Worker y tu clave de app. Toca Guardar y probar.

---

## Paso 3: ponerlo en la pantalla de inicio

**iPhone, con Safari:** abre el sitio, toca Compartir, **Añadir a pantalla de inicio**.
Como el sitio trae `manifest.webmanifest` y las etiquetas de app, el icono abre a pantalla
completa, sin barra de direcciones ni nada del navegador.

**Android, con Chrome:** menú de tres puntos, **Instalar aplicación** o **Agregar a pantalla principal**.

## Dónde viven tus datos

Todo se guarda en el navegador de ese celular: tus comidas fuera, tus planes y el contador
de comidas libres. No viaja a ningún servidor. Por eso conviene entrar de vez en cuando a
**Tu cuenta → Respaldo** y bajar el archivo JSON. Si limpias los datos del navegador o
cambias de celular, ese archivo es lo único que te devuelve el historial.

## Cosas que quizá quieras cambiar

- **El modelo**: la constante `MODELO_POR_DEFECTO` arriba de `worker.js`, o la variable de
  entorno `MODELO` si prefieres cambiarlo sin tocar el código. Si el plan gratis rechaza el
  que trae, prueba `gemini-3.5-flash` o `gemini-3.5-flash-lite`.
- **El umbral del aviso**: la constante `UMBRAL` en `index.html` (0.15 son 15%).
- **Comidas libres al mes**: la constante `LIBRES_MES` en `index.html`.
- **Tu plan de porciones**: no hace falta tocar código, súbelo como foto desde
  **Tu cuenta → Subir nueva dieta**. La constante `PLAN_BASE` solo es el punto de partida.

## Si algo falla

La app trae mensajes concretos para cada caso: llave mal puesta, clave de app que no coincide,
límite diario agotado, modelo que no existe. Cuando el error tiene que ver con la conexión,
aparece un botón que te lleva directo a la pantalla de Conexión para arreglarlo ahí mismo.
