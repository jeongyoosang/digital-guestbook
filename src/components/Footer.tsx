// src/components/Footer.tsx
export default function Footer() {
  return (
    <footer className="py-10 px-4 bg-foreground/5">
      <div className="container mx-auto">
        {/* 아이콘 링크 */}
        <div className="mb-6 flex justify-center gap-3">
          {/* Instagram */}
          <a
            href="https://www.instagram.com/digital_guestbook"
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/60 hover:bg-background transition"
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

          {/* Kakao */}
          <a
            href="https://pf.kakao.com/_UyaHn"
            target="_blank"
            rel="noreferrer"
            aria-label="KakaoTalk Channel"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/60 hover:bg-background transition"
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

        <p className="text-center text-sm text-muted-foreground leading-relaxed">
          ㈜고래유니버스 | 대표 정유상 | 사업자등록번호 : 521-81-03425 <br />
          서대문구 연세로2나길 61 연세대학교 캠퍼스타운 에스큐브 204호
        </p>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          © 2025 GORAE UNIVERSE. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
