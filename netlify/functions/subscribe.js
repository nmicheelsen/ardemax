exports.handler = async function(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

  const SHEETS_URL = process.env.SHEETS_URL;
  if (!SHEETS_URL) return { statusCode: 500, headers, body: JSON.stringify({ error: "SHEETS_URL no configurada" }) };

  try {
    const { perfilId, nombre, disciplina, capa, subscription } = JSON.parse(event.body);

    const res = await fetch(SHEETS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accion: "guardar_suscripcion",
        datos: { perfilId, nombre, disciplina, capa, subscription: JSON.stringify(subscription) }
      })
    });

    const data = await res.json();
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch(err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
