const DOMAIN_TO_API_HOST = {
  // Production Agents
  'agents.realityspiral.com': 'eliza.realityspiral.com:5010',
  'agents-api.realityspiral.com': 'eliza.realityspiral.com:3010',
  
  // Production Prosper
  'prosper.realityspiral.com': 'eliza.realityspiral.com:5020',
  'prosper-api.realityspiral.com': 'eliza.realityspiral.com:3020',
  
  // Staging Agents
  'staging.agents.realityspiral.com': 'eliza.realityspiral.com:5030',
  'staging.agents-api.realityspiral.com': 'eliza.realityspiral.com:3030',
  
  // Staging Prosper
  'staging.prosper.realityspiral.com': 'eliza.realityspiral.com:5040',
  'staging.prosper-api.realityspiral.com': 'eliza.realityspiral.com:3040',
  
  // Dev Agents
  'dev.agents.realityspiral.com': 'eliza.realityspiral.com:5050',
  'dev.agents-api.realityspiral.com': 'eliza.realityspiral.com:3050',
  
  // Dev Prosper
  'dev.prosper.realityspiral.com': 'eliza.realityspiral.com:5060',
  'dev.prosper-api.realityspiral.com': 'eliza.realityspiral.com:3060',
}

async function handleRequest(event) {
  const url = new URL(event.request.url)
  const pathname = url.pathname
  const search = url.search
  const pathWithParams = pathname + search
  
  // Get the API host based on the request domain
  const apiHost = DOMAIN_TO_API_HOST[url.host]
  if (!apiHost) {
    return new Response('Domain not configured', { status: 404 })
  }

  let response
  if (pathname.startsWith("/static/") || pathname.endsWith(".png")) {
    response = await retrieveStatic(event, pathWithParams, apiHost)
  } else {
    response = await forwardRequest(event, pathWithParams, url.host, apiHost)
  }
  response = new Response(response.body, response);
  response.headers.set("Access-Control-Allow-Origin", "*");
  return response
}

async function retrieveStatic(event, pathname, apiHost) {
  let response = await caches.default.match(event.request)
  if (!response) {
    response = await fetch(`http://${apiHost}${pathname}`)
    event.waitUntil(caches.default.put(event.request, response.clone()))
  }
  return response
}

async function forwardRequest(event, pathWithSearch, originalHost, apiHost) {
  const request = new Request(event.request)
  request.headers.delete("cookie")
  request.headers.set("Host", originalHost);

  const response = await fetch(`http://${apiHost}${pathWithSearch}`, request)

  // Read the body and replace the apiHost domain with the originalHost
  let body = await response.text()
  body = body.replace(new RegExp(apiHost, "g"), originalHost)

  return new Response(body, response)
}

addEventListener("fetch", (event) => {
  event.passThroughOnException()
  event.respondWith(handleRequest(event))
})