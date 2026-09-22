/**
 * Plato Justo - función de servidor.
 *
 * Guarda tu llave de la API de Gemini y hace la llamada por ti, para que la llave
 * nunca viaje al celular. Este archivo funciona de dos formas:
 *
 *   1. Como Cloudflare Worker suelto (lo pegas en el panel de Cloudflare).
 *   2. Como función de Cloudflare Pages, a través de functions/api/analizar.js,
 *      que lo importa.
 *
 * Variables de entorno que hay que configurar:
 *   GEMINI_API_KEY      (obligatoria)  tu llave, la de aistudio.google.com
 *   CLAVE_APP           (recomendada)  una contraseña que tú inventas; la app te
 *                                      la pide una vez y la guarda en tu celular.
 *                                      Sin esto, cualquiera con la URL puede
 *                                      gastar tu límite gratis.
 *   ORIGEN_PERMITIDO    (opcional)     la dirección de tu sitio, por ejemplo
 *                                      https://tuusuario.github.io
 *   MODELO              (opcional)     para cambiar de modelo sin tocar el código.
 */

/* Si el plan gratis rechaza este modelo, prueba con "gemini-3.5-flash"
   o "gemini-3.5-flash-lite", que son los más ligeros. */
const MODELO_POR_DEFECTO = "gemini-3.6-flash";
const MAX_TOKENS = 8192;

function cors(env, extra) {
  const origen = (env && env.ORIGEN_PERMITIDO) || "*";
  return Object.assign({
    "Access-Control-Allow-Origin": origen,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-clave-app",
    "Access-Control-Max-Age": "86400"
  }, extra || {});
}

function json(obj, status, env) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: cors(env, { "content-type": "application/json; charset=utf-8" })
  });
}

export async function manejar(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(env) });
  }
  if (request.method !== "POST") {
    return json({ error: "metodo_no_permitido" }, 405, env);
  }
  if (!env || !env.GEMINI_API_KEY) {
    return json({ error: "sin_llave", mensaje: "Falta configurar GEMINI_API_KEY." }, 500, env);
  }
  if (env.CLAVE_APP && request.headers.get("x-clave-app") !== env.CLAVE_APP) {
    return json({ error: "clave_incorrecta" }, 401, env);
  }

  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch (e) {
    return json({ error: "cuerpo_invalido" }, 400, env);
  }

  const prompt = String(cuerpo.prompt || "").slice(0, 20000);
  if (!prompt) return json({ error: "sin_prompt" }, 400, env);

  const partes = [];
  if (cuerpo.imagen && cuerpo.imagen.datos) {
    partes.push({
      inline_data: {
        mime_type: String(cuerpo.imagen.tipo || "image/jpeg"),
        data: String(cuerpo.imagen.datos)
      }
    });
  }
  partes.push({ text: prompt });

  const modelo = (env && env.MODELO) || MODELO_POR_DEFECTO;
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" +
              encodeURIComponent(modelo) + ":generateContent";

  let respuesta;
  try {
    respuesta = await fetch(url, {
      method: "POST",
      headers: {
        "x-goog-api-key": env.GEMINI_API_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: partes }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: MAX_TOKENS,
          // Gemini devuelve JSON puro, sin ```json alrededor.
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    });
  } catch (e) {
    return json({ error: "sin_conexion" }, 502, env);
  }

  const texto_crudo = await respuesta.text();

  if (!respuesta.ok) {
    let codigo = "error_api";
    if (respuesta.status === 429) codigo = "limite_diario";
    else if (respuesta.status === 403) codigo = "llave_invalida";
    else if (respuesta.status === 400 && texto_crudo.indexOf("API key") !== -1) codigo = "llave_invalida";
    else if (respuesta.status === 404) codigo = "modelo_desconocido";
    else if (respuesta.status === 503) codigo = "ocupado";
    return json({ error: codigo, detalle: texto_crudo.slice(0, 400) }, respuesta.status, env);
  }

  let datos;
  try {
    datos = JSON.parse(texto_crudo);
  } catch (e) {
    return json({ error: "error_api" }, 502, env);
  }

  const bloqueo = datos.promptFeedback && datos.promptFeedback.blockReason;
  if (bloqueo) return json({ error: "refused", detalle: bloqueo }, 200, env);

  const candidato = (datos.candidates || [])[0];
  const texto = (((candidato || {}).content || {}).parts || [])
    .map(function (p) { return p.text || ""; })
    .join("");

  if (!texto) return json({ error: "sin_respuesta" }, 200, env);

  return json({ texto: texto, uso: datos.usageMetadata || null }, 200, env);
}

export default {
  fetch(request, env) {
    return manejar(request, env);
  }
};
