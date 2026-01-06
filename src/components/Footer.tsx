export default function Footer() {
  return (
    <footer className="px-6">
      <div className="mx-auto max-w-7xl">
        {/* Luma 느낌: 얇은 선 */}
        <div className="h-px bg-border/60" />

        <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Left */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="cursor-default hover:text-foreground transition">
              이용약관
            </span>
            <span className="cursor-default hover:text-foreground transition">
              개인정보처리방침
            </span>
            <span className="cursor-default hover:text-foreground transition">
              보안
            </span>
          </div>

          {/* Right icons */}
          <div className="flex items-center gap-3 sm:justify-end">
            <a
              href="https://www.instagram.com/digital_guestbook"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background hover:bg-foreground/5 transition"
              title="Instagram"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M17.5 6.5h.01"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </a>

            <a
              href="https://pf.kakao.com/_UyaHn"
              target="_blank"
              rel="noreferrer"
              aria-label="KakaoTalk Channel"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background hover:bg-foreground/5 transition"
              title="KakaoTalk Channel"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 4c-5 0-9 3.1-9 7 0 2.6 1.8 4.9 4.6 6.2L7 21l4-2.2c.3 0 .7.1 1 .1 5 0 9-3.1 9-7s-4-7-9-7Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
        </div>

        {/* 사업자 정보: 더 컴팩트 */}
        <div className="pb-8">
          <p className="text-center text-xs text-muted-foreground leading-relaxed">
            ㈜고래유니버스 | 대표 정유상 | 사업자등록번호 : 521-81-03425 <br />
            서울특별시 서대문구 연세로2나길 61 204호
          </p>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            © 2025 GORAE UNIVERSE. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
