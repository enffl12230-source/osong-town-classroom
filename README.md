# 오송 동네 탐험대

2022 개정 교육과정 초등 2학년 통합교과 수업을 위한 오송 마을 탐방 정적 웹사이트입니다. 우리 동네 지도, 장소 카드, 학생용 활동지와 교사용 PDF를 제공합니다.

## 바로 쓰기

[오송 동네 탐험대 열기](https://enffl12230-source.github.io/osong-town-classroom/) · [학생용 활동지](pdf/student-worksheet.pdf) · [교사용 안내서](pdf/teacher-guide.pdf)

지도나 장소 목록에서 탐방할 곳을 골라 장소 카드를 읽습니다. 학생용 활동지는 인쇄해서 수업에 사용할 수 있습니다.

## 코드는 어떻게 구성되어 있나요?

| 파일 | 역할 |
| --- | --- |
| [index.html](index.html) | 지도, 장소 목록, 장소 상세 창 등 화면의 기본 구조를 정합니다. |
| [style.css](style.css) | 화면의 색상, 글자 크기, 카드 배치를 정합니다. |
| [app.js](app.js) | 장소 자료를 읽어 목록을 그리고, 장소를 선택하면 상세 창을 엽니다. 지도와 방문 표시도 이 파일에서 처리합니다. |
| [assets/](assets/) | 지도를 표시하는 Leaflet 라이브러리, 글꼴, 오송역 사진을 담습니다. |
| [pdf/](pdf/) | 학생용 활동지와 교사용 안내서 등의 HTML 원본, PDF 파일, PDF 생성 스크립트를 담습니다. |

장소 정보를 고치려면 `app.js` 맨 위의 `places` 목록을 확인하세요. `render()`는 목록을 화면에 표시하고, `openPlace()`는 선택한 장소의 정보를 엽니다. 방문 표시는 브라우저의 `sessionStorage`에 저장해 같은 탭에서 새로고침해도 유지됩니다.

## 실행

인터넷 연결 후 이 폴더를 정적 웹 서버로 열고 `index.html`에 접속합니다. 지도 타일은 OpenStreetMap에서 제공하며 지도가 보이지 않아도 장소 목록을 이용할 수 있습니다.

## GitHub Pages 배포

1. 기본 브랜치를 `main`으로 지정하고 파일을 푸시합니다.
2. GitHub 저장소의 **Settings → Pages → Build and deployment → Source**에서 **GitHub Actions**를 선택합니다.
3. `main`에 푸시하거나 Actions의 **Deploy to GitHub Pages**를 직접 실행합니다.
4. Actions 실행과 Pages 환경의 배포 URL을 확인합니다.

별도 서버, 로그인 또는 학생 개인정보 수집 없이 사용할 수 있습니다. 지도 출처와 장소 자료 출처는 사이트에서 확인할 수 있습니다.
