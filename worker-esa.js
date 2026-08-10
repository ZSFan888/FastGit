// FastGit for Alibaba Cloud ESA Pages.
// Use this file as the Pages function entry.

const ALLOW_LOGIN = false;
const SOURCE_REPOSITORY = "ZhangShengFan/FastGit";
const PRIMARY_HOST = "github.com";
const PROXY_PREFIX = "/_proxy/";
const STATIC_CACHE_HOSTS = new Set(["github.githubassets.com"]);

const REWRITTEN_HOSTS = [
  "github.githubassets.com",
  "avatars.githubusercontent.com",
  "private-avatars.githubusercontent.com",
  "camo.githubusercontent.com",
  "codeload.github.com",
  "media.githubusercontent.com",
  "raw.githubusercontent.com",
  "objects.githubusercontent.com",
  "objects-origin.githubusercontent.com",
  "user-images.githubusercontent.com",
  "private-user-images.githubusercontent.com",
  "secured-user-images.githubusercontent.com",
  "release-assets.githubusercontent.com",
  "repository-images.githubusercontent.com",
  "marketplace-screenshots.githubusercontent.com",
  "opengraph.githubassets.com",
  "identicons.github.com",
  "api.github.com",
  "alive.github.com",
  "uploads.github.com",
  "gist.github.com",
  "collector.github.com",
];

export default {
  async fetch(request) {
    try {
      return await proxyRequest(request);
    } catch (error) {
      const errorId = createErrorId();
      const message = error instanceof Error ? error.message : "Unknown error";
      writeLog("error", JSON.stringify({ errorId, name: error?.name || "Error", message: message.slice(0, 300) }));
      return new Response(`Mirror error. Error ID: ${errorId}`, {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Mirror-Error-ID": errorId,
        },
      });
    }
  },
};

function createErrorId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function writeLog(level, ...args) {
  if (typeof console === "undefined") return;
  const logger = typeof console[level] === "function" ? console[level] : console.log;
  if (typeof logger === "function") logger.apply(console, args);
}

async function proxyRequest(request) {
  const publicUrl = new URL(request.url);

  if (publicUrl.pathname === "/healthy") {
    return createHealthResponse(ALLOW_LOGIN);
  }

  const upstreamUrl = getUpstreamUrl(publicUrl);

  if (!ALLOW_LOGIN && isLoginPath(upstreamUrl.pathname)) {
    return new Response("Login is disabled in worker.js.", { status: 403 });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("Host");
  requestHeaders.delete("CF-Connecting-IP");
  requestHeaders.delete("CF-IPCountry");
  requestHeaders.delete("CF-Ray");
  requestHeaders.delete("CF-Visitor");
  requestHeaders.delete("X-Forwarded-For");
  requestHeaders.delete("X-Forwarded-Host");
  requestHeaders.delete("Cf-Access-Jwt-Assertion");

  const incomingCookie = requestHeaders.get("Cookie");
  if (incomingCookie) {
    const filteredCookie = incomingCookie
      .split(";")
      .map((part) => part.trim())
      .filter((part) => !/^(?:CF_Authorization|CF_Binding)=/i.test(part))
      .join("; ");
    if (filteredCookie) requestHeaders.set("Cookie", filteredCookie);
    else requestHeaders.delete("Cookie");
  }

  if (upstreamUrl.hostname !== PRIMARY_HOST) {
    requestHeaders.delete("Cookie");
  }

  if (upstreamUrl.hostname !== PRIMARY_HOST && upstreamUrl.hostname !== "api.github.com") {
    requestHeaders.delete("Authorization");
  }

  if (requestHeaders.has("Origin")) {
    requestHeaders.set("Origin", "https://github.com");
  }

  const referer = requestHeaders.get("Referer");
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.host === publicUrl.host) {
        requestHeaders.set("Referer", getUpstreamUrl(refererUrl).toString());
      }
    } catch {
      requestHeaders.delete("Referer");
    }
  }

  const fetchOptions = {
    method: request.method,
    headers: requestHeaders,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    fetchOptions.body = request.body;
  }

  const cacheable = request.method === "GET" && STATIC_CACHE_HOSTS.has(upstreamUrl.hostname);
  const edgeCache = typeof cache !== "undefined" ? cache : null;
  const cacheKey = `http://${publicUrl.host}${publicUrl.pathname}${publicUrl.search}`;

  if (cacheable && edgeCache) {
    try {
      const cached = await edgeCache.get(cacheKey);
      if (cached) {
        const cacheHitResponse = new Response(cached.body, cached);
        cacheHitResponse.headers.set("X-Mirror-Cache", "HIT");
        return cacheHitResponse;
      }
    } catch (error) {
      writeLog("warn", "Mirror cache read failed:", error instanceof Error ? error.message : "Unknown error");
    }
  }

  const upstreamResponse = await fetch(upstreamUrl.toString(), fetchOptions);

  if (upstreamResponse.status === 101 && upstreamResponse.webSocket) {
    return upstreamResponse;
  }

  const response = await buildResponse(upstreamResponse, publicUrl, upstreamUrl, request.method);

  if (cacheable && edgeCache && response.ok && !response.headers.has("Set-Cookie")) {
    const cachedResponse = new Response(response.body, response);
    cachedResponse.headers.set("Cache-Control", "public, max-age=3600");
    cachedResponse.headers.set("X-Mirror-Cache", "MISS");
    try {
      await edgeCache.put(cacheKey, cachedResponse.clone());
    } catch (error) {
      writeLog("warn", "Mirror cache write failed:", error instanceof Error ? error.message : "Unknown error");
    }
    return cachedResponse;
  }

  return response;
}

async function createHealthResponse(loginEnabled) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  let upstreamStatus = null;
  let commitVersion = "unknown";
  let healthy = false;

  try {
    const [upstreamResult, commitResult] = await Promise.allSettled([
      fetch("https://github.com/", {
        method: "HEAD",
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "FastGit-Health-Check" },
      }),
      fetch(`https://api.github.com/repos/${SOURCE_REPOSITORY}/commits/main`, {
        signal: controller.signal,
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "FastGit-Health-Check",
        },
      }),
    ]);

    if (upstreamResult.status === "fulfilled") {
      upstreamStatus = upstreamResult.value.status;
      healthy = upstreamStatus >= 200 && upstreamStatus < 400;
    }

    if (commitResult.status === "fulfilled" && commitResult.value.ok) {
      try {
        const commit = await commitResult.value.json();
        if (typeof commit.sha === "string") commitVersion = commit.sha.slice(0, 7);
      } catch {
        commitVersion = "unknown";
      }
    }
  } catch {
    healthy = false;
  } finally {
    clearTimeout(timeout);
  }

  const duration = Date.now() - startedAt;
  const checkedAt = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());

  return new Response(renderHealthPage({
    healthy,
    upstreamStatus,
    duration,
    checkedAt,
    loginEnabled,
    commitVersion,
  }), {
    status: healthy ? 200 : 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "X-FastGit-Commit": commitVersion,
    },
  });
}

function renderHealthPage({ healthy, upstreamStatus, duration, checkedAt, loginEnabled, commitVersion }) {
  const stateClass = healthy ? "healthy" : "unhealthy";
  const stateTitle = healthy ? "OK" : "暂不可用";
  const kicker = healthy ? "所有系统运行正常" : "检测到服务异常";
  const description = healthy
    ? "FastGit 已成功连接 GitHub 上游服务。"
    : "FastGit 暂时无法正常连接 GitHub 上游服务。";
  const upstreamText = upstreamStatus === null
    ? "连接失败"
    : `${healthy ? "正常" : "异常"}（HTTP ${upstreamStatus}）`;
  const commitText = commitVersion === "unknown" ? "无法获取" : commitVersion;

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>FastGit 服务状态</title>
  <style>
    *{box-sizing:border-box}
    html{background:#f5f5f7}
    body{margin:0;min-height:100vh;background:#fff;color:#1d1d1f;font-family:"SF Pro Text",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;letter-spacing:0}
    .global-nav{height:44px;background:#000;color:#fff}
    .nav-inner,.subnav-inner,.hero-inner,.metrics-inner,.footer-inner{width:min(980px,calc(100% - 48px));margin:0 auto}
    .nav-inner{display:flex;height:44px;align-items:center;justify-content:space-between;font-size:12px}
    .nav-brand{font-weight:600}.nav-label{color:#ccc}
    .subnav{height:52px;background:rgba(245,245,247,.88);border-bottom:1px solid rgba(0,0,0,.08);backdrop-filter:saturate(180%) blur(20px)}
    .subnav-inner{display:flex;height:52px;align-items:center;justify-content:space-between}
    .subnav-title{font-size:21px;font-weight:600}.subnav-meta{color:#333;font-size:14px}
    .hero{background:#fff;text-align:center}
    .unhealthy .hero{background:#272729;color:#fff}
    .hero-inner{padding:80px 0 72px}
    .kicker{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 0 17px;color:#333;font-size:14px;font-weight:600}
    .unhealthy .kicker{color:#ccc}
    .status-dot{width:8px;height:8px;border-radius:50%;background:#0066cc}
    h1{margin:0;font-family:"SF Pro Display",system-ui,-apple-system,sans-serif;font-size:56px;font-weight:600;line-height:1.07;letter-spacing:0}
    .lead{max-width:680px;margin:17px auto 0;color:#333;font-family:"SF Pro Display",system-ui,-apple-system,sans-serif;font-size:24px;font-weight:300;line-height:1.5;letter-spacing:0}
    .unhealthy .lead{color:#ccc}
    .actions{display:flex;justify-content:center;gap:12px;margin-top:32px}
    .button{display:inline-flex;min-height:44px;align-items:center;justify-content:center;padding:11px 22px;border:1px solid #0066cc;border-radius:9999px;color:#0066cc;font-size:17px;text-decoration:none;transition:transform .15s ease,background-color .15s ease}
    .button.primary{background:#0066cc;color:#fff}
    .button:active{transform:scale(.95)}
    .button:focus-visible{outline:2px solid #0071e3;outline-offset:3px}
    .unhealthy .button:not(.primary){color:#2997ff;border-color:#2997ff}
    .metrics{background:#f5f5f7}
    .metrics-inner{padding:64px 0}
    h2{margin:0 0 32px;font-family:"SF Pro Display",system-ui,-apple-system,sans-serif;font-size:34px;font-weight:600;line-height:1.47;letter-spacing:0;text-align:center}
    dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin:0;border-top:1px solid #e0e0e0}
    .metric{min-width:0;padding:24px 20px;border-bottom:1px solid #e0e0e0;text-align:center}
    dt{margin-bottom:8px;color:#7a7a7a;font-size:14px;line-height:1.43}
    dd{margin:0;color:#1d1d1f;font-size:17px;font-weight:600;line-height:1.47;overflow-wrap:anywhere}
    footer{background:#f5f5f7;color:#7a7a7a}
    .footer-inner{padding:24px 0 48px;border-top:1px solid #e0e0e0;font-size:12px;text-align:center}
    @media(max-width:640px){.nav-inner,.subnav-inner,.hero-inner,.metrics-inner,.footer-inner{width:min(100% - 32px,980px)}.hero-inner{padding:64px 0 56px}h1{font-size:40px}.lead{font-size:21px;line-height:1.4}.actions{align-items:stretch;flex-direction:column}.button{width:100%}dl{grid-template-columns:1fr}.metric{text-align:left;padding:20px 0}h2{font-size:28px;text-align:left}.metrics-inner{padding:48px 0}}
  </style>
</head>
<body class="${stateClass}">
  <header class="global-nav"><div class="nav-inner"><span class="nav-brand">FastGit</span><span class="nav-label">非官方 GitHub 镜像</span></div></header>
  <div class="subnav"><div class="subnav-inner"><span class="subnav-title">服务状态</span><span class="subnav-meta">实时检查</span></div></div>
  <main>
    <section class="hero" aria-labelledby="status-title">
      <div class="hero-inner">
        <p class="kicker"><span class="status-dot" aria-hidden="true"></span>${kicker}</p>
        <h1 id="status-title">${stateTitle}</h1>
        <p class="lead">${description}</p>
        <nav class="actions" aria-label="页面操作">
          <a class="button primary" href="/healthy">重新检查</a>
          <a class="button" href="/">返回首页</a>
        </nav>
      </div>
    </section>
    <section class="metrics" aria-labelledby="metrics-title">
      <div class="metrics-inner">
        <h2 id="metrics-title">实时状态</h2>
        <dl>
          <div class="metric"><dt>Worker 服务</dt><dd>正常</dd></div>
          <div class="metric"><dt>GitHub 上游</dt><dd>${upstreamText}</dd></div>
          <div class="metric"><dt>提交版本</dt><dd>${commitText}</dd></div>
          <div class="metric"><dt>网页登录</dt><dd>${loginEnabled ? "已开启" : "已关闭"}</dd></div>
          <div class="metric"><dt>检查耗时</dt><dd>${duration} 毫秒</dd></div>
          <div class="metric"><dt>检查时间</dt><dd>${checkedAt}</dd></div>
        </dl>
      </div>
    </section>
  </main>
  <footer><div class="footer-inner">FastGit 服务状态</div></footer>
</body>
</html>`;
}

function getUpstreamUrl(publicUrl) {
  if (!publicUrl.pathname.startsWith(PROXY_PREFIX)) {
    return new URL(`https://${PRIMARY_HOST}${publicUrl.pathname}${publicUrl.search}`);
  }

  const rest = publicUrl.pathname.slice(PROXY_PREFIX.length);
  const slash = rest.indexOf("/");
  const hostname = decodeURIComponent(slash === -1 ? rest : rest.slice(0, slash)).toLowerCase();
  const pathname = slash === -1 ? "/" : rest.slice(slash);

  if (!isGithubHost(hostname)) {
    throw new Error("Upstream host is not allowed");
  }

  return new URL(`https://${hostname}${pathname}${publicUrl.search}`);
}

function isGithubHost(hostname) {
  const host = hostname.toLowerCase();
  return (
    host === "github.com" ||
    host.endsWith(".github.com") ||
    host === "githubusercontent.com" ||
    host.endsWith(".githubusercontent.com") ||
    host === "githubassets.com" ||
    host.endsWith(".githubassets.com")
  );
}

function isLoginPath(pathname) {
  return /^\/(?:login|session|sessions|signup|password_reset)(?:\/|$)/.test(pathname);
}

async function buildResponse(upstreamResponse, publicUrl, upstreamUrl, method) {
  const headers = new Headers(upstreamResponse.headers);

  for (const headerName of ["Location", "Content-Location", "Link", "Refresh", "Access-Control-Allow-Origin"]) {
    const value = headers.get(headerName);
    if (value) headers.set(headerName, rewriteText(value, publicUrl));
  }

  rewriteCookies(upstreamResponse.headers, headers, upstreamUrl.hostname);

  for (const headerName of ["Content-Security-Policy", "Content-Security-Policy-Report-Only"]) {
    const value = headers.get(headerName);
    if (value) headers.set(headerName, rewriteContentSecurityPolicy(value, publicUrl));
  }
  headers.delete("Report-To");
  headers.delete("NEL");
  if (method === "HEAD" || [204, 205, 304].includes(upstreamResponse.status)) {
    headers.delete("Content-Length");
    headers.delete("Content-Encoding");
    return new Response(null, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    });
  }

  const contentType = (headers.get("Content-Type") || "").toLowerCase();
  const rewriteBody = [
    "text/html",
    "text/css",
    "javascript",
    "application/json",
    "application/manifest+json",
    "image/svg+xml",
  ].some((type) => contentType.includes(type));

  if (!rewriteBody) {
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    });
  }

  const body = rewriteText(await upstreamResponse.text(), publicUrl);
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  headers.delete("ETag");

  return new Response(body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers,
  });
}

function rewriteText(input, publicUrl) {
  let output = input;
  const origin = publicUrl.origin;
  const wsOrigin = `wss://${publicUrl.host}`;

  for (const host of REWRITTEN_HOSTS) {
    const path = `${PROXY_PREFIX}${host}`;
    output = output.replaceAll(`https://${host}`, `${origin}${path}`);
    output = output.replaceAll(`http://${host}`, `${origin}${path}`);
    output = output.replaceAll(`wss://${host}`, `${wsOrigin}${path}`);
    output = output.replaceAll(`https:\\/\\/${host}`, `${origin}${path}`.replaceAll("/", "\\/"));
  }

  output = output.replaceAll("https://github.com", origin);
  output = output.replaceAll("http://github.com", origin);
  output = output.replaceAll("https:\\/\\/github.com", origin.replaceAll("/", "\\/"));
  return output;
}

function rewriteContentSecurityPolicy(policy, publicUrl) {
  return policy
    .split(";")
    .map((directive) => {
      const tokens = directive.trim().split(/\s+/).filter(Boolean);
      if (publicUrl.protocol === "http:" && tokens[0]?.toLowerCase() === "upgrade-insecure-requests") {
        return "";
      }
      if (tokens.length < 2) return directive.trim();

      const sources = tokens.slice(1);
      const containsGithubSource = sources.some((source) => {
        const withoutScheme = source.replace(/^(?:https?|wss?):\/\//i, "");
        const hostname = withoutScheme.split("/", 1)[0].replace(/^\*\./, "");
        return isGithubHost(hostname);
      });

      if (containsGithubSource && !sources.includes("'self'")) sources.unshift("'self'");
      return [tokens[0], ...new Set(sources)].join(" ");
    })
    .filter(Boolean)
    .join("; ");
}

function rewriteCookies(sourceHeaders, targetHeaders, upstreamHost) {
  targetHeaders.delete("Set-Cookie");
  if (upstreamHost !== PRIMARY_HOST) return;

  let cookies = [];
  if (typeof sourceHeaders.getSetCookie === "function") {
    cookies = sourceHeaders.getSetCookie();
  } else {
    const combined = sourceHeaders.get("Set-Cookie");
    if (combined) cookies = [combined];
  }

  for (const cookie of cookies) {
    targetHeaders.append("Set-Cookie", cookie.replace(/;\s*Domain=[^;]+/gi, ""));
  }
}
