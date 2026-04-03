exports.handler = async function(event) {
  const SHEETS_URL = process.env.SHEETS_URL;

  if (!SHEETS_URL) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "SHEETS_URL no configurada en variables de entorno" })
    };
  }

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    let response;

    if (event.httpMethod === "GET") {
      const params = event.queryStringParameters || {};
      const query = new URLSearchParams(params).toString();
      response = await fetch(`${SHEETS_URL}?${query}`);

    } else if (event.httpMethod === "POST") {
      response = await fetch(SHEETS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: event.body
      });
    }

    const data = await response.text();
    return { statusCode: 200, headers, body: data };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
