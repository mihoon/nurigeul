# 누리글 (Nurigeul)

아래아한글의 단축키와 화면 흐름을 그대로 따르면서, VS Code의 여러 커서·감싸기 같은 편집 기능을 더한 가벼운 Windows 문서 편집기입니다.
기본 문서 형식은 한글과 호환되는 **HWPX**이고, **HWP(한글 97~2022) 파일도 열면 HWPX로 바꿔 불러옵니다.** DOCX·PDF로 내보낼 수 있습니다.

## 실행

- [Releases](../../releases)에서 `Nurigeul-버전-win-x64.zip`을 받아 압축을 풀고 **Nurigeul.exe**를 실행합니다. (설치 필요 없음)
- 파일 하나짜리 `Nurigeul-Portable-버전.exe`도 있지만, 실행할 때마다 임시 폴더에 풀기 때문에 시작이 몇 초 느립니다.
- 처음 실행할 때 Windows SmartScreen 경고가 뜨면 [추가 정보 → 실행]을 누르세요. 코드 서명이 없는 프로그램이라 뜨는 경고입니다.

## 파일 형식

| 형식 | 열기 | 저장 | 비고 |
|---|---|---|---|
| HWPX | O | O (기본) | 한글에서 그대로 열림 |
| HWP (5.x) | O | – | 열 때 HWPX로 변환, 저장은 .hwpx |
| DOCX | – | 내보내기 | |
| PDF | – | 내보내기 | |
| TXT, HTML | O | – | |

## VS Code에서 가져온 기능

| 기능 | 누리글 | VS Code |
|---|---|---|
| 같은 글자 모두 선택 → 동시 편집 | Ctrl+Shift+; | Ctrl+Shift+L |
| 위·아래 **문단**에 커서 추가 | Ctrl+Alt+↑ / ↓ | Ctrl+Alt+↑ / ↓ |
| 블록을 괄호·따옴표로 감싸기 | 블록 + ( [ { " ' < ` 「 『 《 〈 【 | 같음 |
| 사각형(세로) 선택 | F4 또는 Alt+끌기 | Shift+Alt+끌기 |
| 문서 탭, 창 나누기(좌우/위아래) | 보기 → 창 나누기 | 편집기 분할 |
| 다른 프로그램에 붙일 때 문단 하나 = 줄 하나 | Ctrl+C | – |

- 여러 커서 상태에서는 입력(한글 조합 포함), Backspace/Delete, Ctrl+Backspace, 방향키, Home/End, Shift 선택, Tab이 모든 커서에 적용되고, Esc로 끝납니다.
- Ctrl+Alt+↑/↓는 화면에서 줄바꿈된 줄이 아니라 엔터로 나뉜 문단 단위로, 같은 글자 위치에 커서를 더합니다.

## 주요 기능

| 구분 | 내용 |
|---|---|
| 서식 | 글꼴·크기·진하게·기울임·밑줄·첨자·글자 색·형광펜·자간(Shift+Alt+W/N)·장평(Shift+Alt+J/K)·그림자·외곽선·글자 테두리, 정렬 5종, 줄 간격, 문단 위·아래 간격(한글처럼 더해짐), 탭(눈금자 오른쪽 클릭, 채울 모양), 스타일, 모양 복사(Alt+C), 기본 글꼴 설정 |
| 문단 번호 | 번호·글머리표, 번호 모양 12가지, 수준, 새 번호로 시작(원하는 번호), 빈 번호 줄 Enter → 번호 없는 줄 |
| 표 | 만들기, 셀 블록(F5)·세로 줄(F7)·가로 줄(F8) 선택, 합치기(M)·나누기(S), 테두리(L): 바깥/안쪽/변마다 종류·굵기(mm)·색, 대각선, 셀 배경 그림(셀마다 또는 여러 셀에 한 장으로), 높이·너비 같게(H/W, 표 크기 유지), 선 끌어 크기 조절(표 크기 유지), 안팎 여백, 배치 |
| 그림·도형 | 그림, 캡션(Ctrl+N,C, 자동 번호·파일 이름), 글상자, 직선·화살표·사각형·타원·삼각형, 도형 안 글자, 글자처럼/어울림/글 앞/글 뒤, 테두리·그림자, 크기 직접 입력, 묶기(Ctrl+G) |
| 쪽 | 편집 용지(F7), 쪽 나누기, 다단, 쪽 번호(모양·꾸밈·글꼴), 새 번호, 현재 쪽만 감추기, 머리말·꼬리말(세 칸, {쪽} {전체쪽} {날짜} {파일이름}) |
| 보기 | 쪽 윤곽, 문단 부호, 조판 부호, 눈금자, 확대 |
| 도구 | 찾기·바꾸기, 키 매크로, 메일머지, 문자표, 단축키 목록(F1) |

## 개발

```bash
npm install
npm start                           # 실행
npx electron-builder --win dir      # dist/win-unpacked (Nurigeul.exe)
npx electron-builder --win portable # 파일 하나짜리 exe
```

- Electron 앱이며, 화면 코드는 `src/`의 일반 JavaScript입니다(번들러 없음).
- `src/hwpx.js` HWPX 읽기/쓰기, `src/hwp5.js` HWP → HWPX 변환, `src/docx-export.js` DOCX 내보내기.

## 사용한 라이브러리

| 라이브러리 | 용도 | 라이선스 |
|---|---|---|
| [Electron](https://www.electronjs.org/) | 데스크톱 앱 | MIT |
| [JSZip](https://stuk.github.io/jszip/) | HWPX(zip) 읽기/쓰기 | MIT (또는 GPLv3) |
| [docx](https://github.com/dolanmiu/docx) | DOCX 만들기 | MIT |
| [hwp.js](https://github.com/hahnlee/hwp.js) (`@hwp.js/parser`) | HWP 읽기 | Apache-2.0 (`src/lib/hwp-parser.LICENSE`, `NOTICE`) |
| [Lucide](https://lucide.dev/) | 아이콘 | ISC |

## 라이선스

MIT © mihoon
