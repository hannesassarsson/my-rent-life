/** Cookie med BankID-flödets tillstånd mellan start och återkomst. */
export const STATE_COOKIE = "bp_bankid";

export function stateCookie(url: URL, value: string, maxAge: number) {
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return `${STATE_COOKIE}=${value}; Path=/api/bankid; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

export function redirectTo(url: URL, path: string, cookie?: string) {
  const headers = new Headers({
    Location: new URL(path, url.origin).toString(),
    "Cache-Control": "no-store",
  });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}
