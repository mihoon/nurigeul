// 화면 언어 (한국어 / English)
'use strict';
const I18N = {
  lang: 'ko',
  en: {
    // 메뉴
    '문서': 'Document', '창 나누기 (좌우)': 'Split Window (Side by Side)', '창 나누기 (위아래)': 'Split Window (Top/Bottom)', '창 나누기 해제': 'Remove Split',
    '옆 창에서 보기 (좌우)': 'View in Side Pane', '아래 창에서 보기 (위아래)': 'View in Bottom Pane', '같은 문서 보기': 'Same document', '보기 창': 'View pane',
    '편집 중인 문서의 다른 부분을 볼 수 있습니다': 'Shows another part of the document you are editing', '누르면 이 문서를 편집합니다': 'Click to edit this document',
    '이 창에 보일 문서': 'Document shown in this pane', '창 나누기 해제': 'Remove split', '창을 위아래로 나누었습니다.': 'Window split top/bottom.', '창을 좌우로 나누었습니다.': 'Window split side by side.', '파일': 'File', '편집': 'Edit', '보기': 'View', '입력': 'Insert', '서식': 'Format', '쪽': 'Page', '표': 'Table', '도구': 'Tools', '그림': 'Picture',
    '새 문서': 'New Document', '새 창': 'New Window', '다음 문서 탭': 'Next Document Tab', '이전 문서 탭': 'Previous Document Tab',
    '불러오기…': 'Open…', '저장하기': 'Save', '다른 이름으로 저장하기…': 'Save As…', 'DOCX(Word)로 내보내기…': 'Export to DOCX (Word)…',
    'PDF로 저장하기…': 'Save as PDF…', '편집 용지…': 'Page Setup…', '인쇄…': 'Print…', '문서 닫기': 'Close Document', '끝': 'Exit',
    '되돌리기': 'Undo', '다시 실행': 'Redo', '오려 두기': 'Cut', '복사하기': 'Copy', '붙이기': 'Paste', '골라 붙이기 (텍스트만)': 'Paste Special (Text Only)',
    '모두 선택': 'Select All', '같은 글자 모두 선택': 'Select All Occurrences', '블록 설정': 'Block Selection', '한 줄 지우기': 'Delete Line',
    '줄 뒤 지우기': 'Delete to End of Line', '단어 지우기': 'Delete Word', '찾기…': 'Find…', '찾아 바꾸기…': 'Find and Replace…', '다시 찾기': 'Find Next',
    '찾아가기…': 'Go To…', '모양 복사': 'Copy Format',
    '쪽 윤곽 (쪽 경계 표시)': 'Page Outline (Page Boundaries)', '조판 부호 (문단 끝 표시)': 'Formatting Marks', '가로 눈금자': 'Horizontal Ruler',
    '세로 눈금자': 'Vertical Ruler', '확대': 'Zoom In', '축소': 'Zoom Out', '폭 맞춤': 'Fit Width', '언어: 한국어': 'Language: 한국어', '언어: English': 'Language: English',
    '표 만들기…': 'Create Table…', '그림 넣기…': 'Insert Picture…', '쪽 나누기': 'Page Break', '문자표…': 'Symbols…', '날짜 넣기': 'Insert Date',
    '하이퍼링크…': 'Hyperlink…', '하이퍼링크': 'Hyperlink', '연결 주소': 'Address', '표시할 글자': 'Text to Display', '메일머지 표시 달기…': 'Insert Mail Merge Field…', '탭': 'Tab',
    '글자 모양…': 'Character Format…', '문단 모양…': 'Paragraph Format…', '진하게': 'Bold', '기울임': 'Italic', '밑줄': 'Underline', '취소선': 'Strikethrough',
    '위 첨자': 'Superscript', '아래 첨자': 'Subscript', '보통 모양': 'Normal Text', '글자 크게': 'Larger Font', '글자 작게': 'Smaller Font',
    '자간 넓게': 'Wider Spacing', '자간 좁게': 'Narrower Spacing', '줄 간격 넓게': 'Increase Line Spacing', '줄 간격 좁게': 'Decrease Line Spacing',
    '글꼴': 'Font', '글자 크기': 'Font Size', '글자 색': 'Font Color', '형광펜': 'Highlighter', '양쪽 정렬': 'Justify', '왼쪽 정렬': 'Align Left',
    '가운데 정렬': 'Center', '오른쪽 정렬': 'Align Right', '배분 정렬': 'Distribute', '줄 간격': 'Line Spacing', '첫 줄 들여쓰기': 'First-Line Indent',
    '첫 줄 내어쓰기': 'Hanging Indent', '왼쪽 여백 늘리기': 'Increase Left Margin', '왼쪽 여백 줄이기': 'Decrease Left Margin',
    '글머리표 적용/해제': 'Bullets On/Off', '문단 번호 적용/해제': 'Numbering On/Off', '문단 번호 모양…': 'Numbering Format…', '글머리표 모양…': 'Bullet Style…',
    '새 번호로 시작': 'Restart Numbering', '한 수준 증가': 'Increase List Level', '한 수준 감소': 'Decrease List Level', '스타일…': 'Style…', '스타일': 'Style',
    '바탕글': 'Normal', '본문': 'Body', '개요 1': 'Outline 1', '개요 2': 'Outline 2', '개요 3': 'Outline 3', '개요 4': 'Outline 4', '개요 5': 'Outline 5', '개요 6': 'Outline 6', '개요 7': 'Outline 7',
    '쪽 번호 매기기…': 'Page Numbers…', '머리말/꼬리말…': 'Header/Footer…',
    '줄/칸 추가하기…': 'Insert Rows/Columns…', '아래에 줄 추가': 'Insert Row Below', '오른쪽에 칸 추가': 'Insert Column Right', '줄/칸 지우기…': 'Delete Rows/Columns…',
    '셀 블록': 'Cell Block', '셀 합치기': 'Merge Cells', 'M (셀 블록)': 'M (cell block)', '셀 나누기…': 'Split Cell…', 'S (셀 블록)': 'S (cell block)',
    '셀 테두리/배경…': 'Cell Border/Fill…', 'L (셀 블록)': 'L (cell block)', '셀 너비를 같게': 'Equal Column Widths', 'W (셀 블록)': 'W (cell block)',
    '셀 높이를 같게': 'Equal Row Heights', 'H (셀 블록)': 'H (cell block)', '셀 크기 조절': 'Resize Cells', '셀 크기 조절 (표 크기 유지)': 'Resize Cells (Keep Table Size)',
    '선택한 셀만 크기 조절': 'Resize Selected Cells Only', '셀 내용 지우기': 'Clear Cell Contents', '표 지우기': 'Delete Table', '다음 셀': 'Next Cell',
    '그림 속성…': 'Picture Properties…', '그림 배치': 'Picture Layout',
    '매크로 정의 (기록 시작/끝)': 'Record Macro (Start/Stop)', '매크로 실행…': 'Run Macro…', '메일머지 만들기…': 'Run Mail Merge…',
    '메일머지 자료 문서 만들기…': 'Create Mail Merge Data Document…', '단축키 목록': 'Keyboard Shortcuts', '누리글 정보': 'About Nurigeul',
    // 도구 모음
    '불러오기': 'Open', '저장': 'Save', '인쇄': 'Print', '복사': 'Copy', '문자표': 'Symbols', '찾기': 'Find', '매크로 기록': 'Record', '메일머지': 'Mail Merge',
    '단축키': 'Shortcuts', '스타일 (F6)': 'Style (F6)', '글자 크기(pt)': 'Font size (pt)', ' 고르기': ' palette', '줄 간격 (Alt+Shift+A/Z)': 'Line spacing (Alt+Shift+A/Z)',
    '글자 색 고르기': 'Choose font color', '형광펜 고르기': 'Choose highlight color', '새 문서 (Alt+N)': 'New document (Alt+N)', '문서 닫기 (Ctrl+F4)': 'Close document (Ctrl+F4)',
    // 상태 표시줄 / 기타
    '수정': 'OVR', '삽입': 'INS', 'Insert 키로 전환': 'Toggle with Insert key', '축소 ': 'Zoom out', '누리글': 'Nurigeul',
    '블록 설정 중 (방향키로 범위 지정, Esc 해제)': 'Block mode (extend with arrows, Esc to cancel)',
    '배치: 글자처럼 취급': 'Layout: In Line with Text', '배치: 어울림 (왼쪽)': 'Layout: Wrap (Left)', '배치: 어울림 (오른쪽)': 'Layout: Wrap (Right)',
    '배치: 가운데': 'Layout: Center', '배치: 글 앞으로': 'Layout: In Front of Text', '배치: 글 뒤로': 'Layout: Behind Text', '그림 지우기': 'Delete Picture',
    '글상자': 'Text Box', '직선': 'Line', '화살표': 'Arrow', '양쪽 화살표': 'Double Arrow', '직사각형': 'Rectangle', '둥근 사각형': 'Rounded Rectangle', '타원': 'Ellipse', '삼각형': 'Triangle', '도형': 'Shapes',
    '개체 속성…': 'Object Properties…', '개체 배치': 'Object Layout', '개체 지우기': 'Delete Object', '글상자 속성': 'Text Box Properties', '도형 속성': 'Shape Properties',
    '선': 'Line', '선 색': 'Line color', '선 굵기': 'Line width', '없음': 'None', '끝에': 'At end', '시작에': 'At start', '양쪽': 'Both', '방향': 'Direction',
    '↘ 왼쪽 위 → 오른쪽 아래': '↘ Top-left → bottom-right', '↗ 왼쪽 아래 → 오른쪽 위': '↗ Bottom-left → top-right', '채우기': 'Fill', '면 색 채우기': 'Fill with color', '면 색': 'Fill color',
    '본문과의 배치': 'Text wrapping', '글 앞으로': 'In front of text', '글 뒤로': 'Behind text', '끌어서 표 옮기기': 'Drag to move the table', '그리기를 취소했습니다.': 'Drawing canceled.',
    '표 안의 표는 글자처럼 취급만 할 수 있습니다.': 'A table inside a table can only be in line with text.',
    '배치를 바꿀 개체(그림·도형·글상자)를 선택하거나 표 안에 커서를 두세요.': 'Select a picture, shape or text box, or put the cursor in a table.',
    '도형 넣기 (커서 자리)': 'Insert Shape at Cursor',
    '표 속성 (크기·여백·배치)…': 'Table Properties (Size, Margins, Layout)…', '표 속성': 'Table Properties', '크기': 'Size', '표 너비': 'Table width', '표 높이': 'Table height',
    '현재 칸 너비': 'Current column width', '현재 줄 높이': 'Current row height', '여백': 'Margins', '셀 안 여백 (mm)': 'Cell inner margins (mm)', '안 여백 적용': 'Apply inner margins to',
    '표 전체 셀': 'All cells', '선택한 셀만': 'Selected cells only', '바깥 여백 (mm)': 'Outer margins (mm)', '안 여백 (mm)': 'Inner margins (mm)', '테두리': 'Border', '굵기': 'Width',
    '그림자': 'Shadow', '그림자 방향': 'Shadow direction', '거리': 'Distance', '그림자 색': 'Shadow color', '오른쪽 아래': 'Bottom right', '왼쪽 아래': 'Bottom left', '오른쪽 위': 'Top right', '왼쪽 위': 'Top left',
    '이중선': 'Double', '위': 'Top', '아래': 'Bottom', '대각선': 'Diagonal', '╲ (왼쪽 위 → 오른쪽 아래)': '╲ (top-left → bottom-right)', '╱ (왼쪽 아래 → 오른쪽 위)': '╱ (bottom-left → top-right)', '╳ (둘 다)': '╳ (both)',
    '대각선 색': 'Diagonal color', '대각선 굵기': 'Diagonal width', '효과': 'Effects', '외곽선 (속이 빈 글자)': 'Outline (hollow)', '글자 테두리': 'Character border', '테두리 색': 'Border color',
    '모양 복사 (개체)': 'Copy Format (Object)', '할 일': 'Action', '복사해 둔 개체 모양을 이 개체에 적용': 'Apply the copied object format to this object', '이 개체의 모양을 새로 복사': 'Copy this object\'s format',
    '복사할 모양': 'Copy', '글자 모양과 문단 모양 둘 다': 'Character and paragraph format', '글자 모양만': 'Character format only', '문단 모양만': 'Paragraph format only', '복사': 'Copy',
    '블록을 잡은 뒤 다시 Alt+C를 누르면 복사한 모양이 적용됩니다.': 'Select text and press Alt+C again to apply the copied format.',
    '모양을 복사했습니다. 블록을 지정한 뒤 다시 Alt+C를 누르면 적용됩니다.': 'Format copied. Select text and press Alt+C again to apply it.', '복사한 모양을 적용했습니다.': 'Copied format applied.',
    '개체 모양(테두리·그림자·여백·선·면)을 복사했습니다. 다른 개체를 선택하고 Alt+C를 누르면 적용됩니다.': 'Object format copied (border, shadow, margins, line, fill). Select another object and press Alt+C to apply it.',
    '복사한 개체 모양을 적용했습니다.': 'Copied object format applied.',
    '다단 설정…': 'Columns…', '다단 설정': 'Columns', '단 나누기': 'Column Break', '단 개수': 'Number of columns', '하나 (다단 해제)': 'One (no columns)', '둘': 'Two', '셋': 'Three', '넷': 'Four',
    '단 사이 간격': 'Spacing', '단 사이에 구분선': 'Line between columns', '적용 범위': 'Apply to', '지금 다단 영역': 'This column area', '선택한 문단 (커서가 있는 문단)': 'Selected paragraphs',
    '커서가 있는 문단부터 끝까지': 'From this paragraph to the end', '문서 전체': 'Whole document', '다단 안에서 Ctrl+Shift+Enter를 누르면 다음 단으로 넘어갑니다(단 나누기).': 'Inside columns, Ctrl+Shift+Enter moves to the next column (column break).',
    '단 나누기는 다단 영역 안에서만 쓸 수 있습니다. (쪽 → 다단 설정)': 'Column breaks work only inside a column area (Page → Columns).',
    '현재 쪽만 감추기…': 'Hide on This Page…', '현재 쪽만 감추기': 'Hide on This Page', '감추기': 'Hide', '쪽 번호': 'Page number', '머리말': 'Header', '꼬리말': 'Footer',
    '커서가 있는 쪽에서만 고른 것을 감춥니다. 쪽 번호는 감춰도 그대로 셉니다. 조판 부호를 지우면 다시 나타납니다.': 'Hides the chosen items on the page with the cursor only. Hidden page numbers are still counted. Delete the marker to show them again.',
    '새 번호로 시작…': 'Restart Page Numbering…', '새 번호로 시작': 'Restart Page Numbering', '시작 쪽 번호': 'Start at', '넣기': 'Insert', '번호 모양': 'Number format', '줄표·꾸밈': 'Decoration',
    '시작 번호': 'Start number', '첫 쪽에는 번호 감추기': 'Hide number on first page', '1 / 전체 쪽수': '1 / total pages', '1쪽': 'Page 1 (1쪽)', '새 번호는 본문 문단에 넣어야 합니다.': 'Put the new number in a body paragraph.',
    '중간부터 번호를 다시 매기려면 그 쪽에서 [쪽 → 새 번호로 시작]을 쓰세요. 쪽 번호는 인쇄·PDF와 HWPX·DOCX 파일에 반영됩니다.': 'To restart numbering mid-document, use Page → Restart Page Numbering on that page. Page numbers apply to print, PDF, HWPX and DOCX.',
    '커서가 있는 쪽부터 이 번호로 다시 셉니다. 인쇄·PDF에서는 이 문단이 새 쪽에서 시작하므로 보통 쪽 나누기 바로 뒤, 쪽 맨 위 문단에 넣습니다. 조판 부호를 지우면 원래대로 돌아갑니다.': 'Numbering restarts at this number from the page with the cursor. In print/PDF this paragraph starts a new page, so put it at the top of a page (right after a page break). Delete the marker to undo.',
    '문단 부호 (문단 끝 ↵)': 'Paragraph Marks (¶)', '조판 부호 (줄 나눔·탭·개체·쪽 설정 표시)': 'Control Codes (line breaks, tabs, objects, page settings)',
    '머리말/꼬리말…': 'Header/Footer…', '머리말/꼬리말': 'Header/Footer',
    '아래에 구분선': 'Line below', '위에 구분선': 'Line above', '예: {파일이름}': 'e.g. {파일이름}', '예: - {쪽} -': 'e.g. - {쪽} -', '예: {날짜}': 'e.g. {날짜}',
    '머리말 — 두 번 누르면 고칩니다': 'Header — double-click to edit', '꼬리말 — 두 번 누르면 고칩니다': 'Footer — double-click to edit', '묶음 개체': 'Group',
    '넣을 수 있는 표시: {쪽} 쪽 번호, {전체쪽} 전체 쪽수, {날짜} 오늘 날짜, {파일이름} 문서 이름. 칸을 모두 비우면 없어집니다. 쪽 윤곽에서 쪽의 위·아래 여백을 두 번 눌러도 이 창이 열립니다. 특정 쪽에서만 빼려면 쪽 → 현재 쪽만 감추기.': 'Codes you can use: {쪽} page number, {전체쪽} total pages, {날짜} today\'s date, {파일이름} document name. Leave all boxes empty to remove it. Double-click the top or bottom margin of a page (page outline view) to open this dialog. To leave it off a single page, use Page → Hide on This Page.',
    '중간부터 번호를 다시 매기려면 그 쪽에서 [쪽 → 새 번호로 시작]을 쓰세요. 쪽 번호는 인쇄·PDF와 HWPX·DOCX 파일에 반영됩니다. 머리말·꼬리말과 같은 칸에 넣으면 인쇄할 때 머리말·꼬리말 글자 모양을 따릅니다.': 'To restart numbering midway, use Page → Restart Page Numbering on that page. Page numbers appear in print/PDF and HWPX/DOCX files. When placed in the same slot as header/footer text, printing uses the header/footer character format.',
    '기본 글꼴 설정…': 'Default Font…', '기본 글꼴': 'Default font', '기본 크기': 'Default size', '지금 문서에도 적용': 'Apply to current document too',
    '새 문서는 이 글꼴과 크기로 시작합니다. 글꼴을 따로 지정한 글자는 바뀌지 않습니다. 다른 탭에 열려 있는 문서는 그대로입니다.': 'New documents start with this font and size. Text with its own font is not changed. Documents open in other tabs stay as they are.',
    '문단 번호 새로 시작…': 'Restart Numbering…', '문단 번호 새로 시작': 'Restart Numbering', '커서가 있는 문단부터 이 번호로 다시 매깁니다. 번호 모양이 가·나·다, ①②③이면 그 차례의 글자로 나옵니다.': 'Numbering restarts at this number from the paragraph with the cursor. For formats like 가·나·다 or ①②③, the matching symbol is used.',
    '아래 줄에 커서 추가': 'Add Cursor Below', '위 줄에 커서 추가': 'Add Cursor Above',
    '아래에 더 문단이 없습니다.': 'No more paragraphs below.', '위에 더 문단이 없습니다.': 'No more paragraphs above.',
    '문단 안에 커서를 두고 누르세요.': 'Place the cursor inside a paragraph first.',
    '테두리 — 한꺼번에': 'Borders — all at once', '테두리 — 변마다 따로': 'Borders — per side', '적용할 곳': 'Apply to', '모두 (바깥 + 안쪽)': 'All (outer + inner)', '바깥쪽만': 'Outer only', '안쪽만': 'Inner only', '테두리 모두 없애기': 'Remove all borders',
    '선 (종류·굵기·색)': 'Line (type · width · color)', '안쪽 가로선': 'Inner horizontal', '안쪽 세로선': 'Inner vertical', '대각선 굵기': 'Diagonal width', '일점쇄선': 'Dash-dot', '이점쇄선': 'Dash-dot-dot', '긴 파선': 'Long dash', '얇고 굵은 이중선': 'Thin-thick double', '굵고 얇은 이중선': 'Thick-thin double', '삼중선': 'Triple',
    '굵기는 mm로 직접 적거나 목록에서 고르고, 색은 #RRGGBB 또는 R,G,B로 적을 수 있습니다. 셀 블록(F5)이면 위·아래·왼쪽·오른쪽은 블록의 바깥 변, 안쪽 선은 블록 안의 선입니다. 굵기·색을 고치면 종류가 자동으로 실선이 됩니다.': 'Type a width in mm or pick one from the list; colors can be typed as #RRGGBB or R,G,B. With a cell block (F5), top/bottom/left/right are the block\'s outer edges and inner lines are the lines inside it. Changing width or color switches the type to solid automatically.',
    '세로 줄 전체를 선택했습니다.': 'Selected the whole column.', '가로 줄 전체를 선택했습니다.': 'Selected the whole row.',
    'HWP 문서를 HWPX로 바꾸는 중…': 'Converting HWP to HWPX…', '암호가 걸렸거나 배포용으로 만든 HWP 문서는 열 수 없습니다.': 'Password-protected or distribution-only HWP documents cannot be opened.', 'HWPX 열기/저장 · HWP 열기(HWPX로 변환) · DOCX/PDF 내보내기 · 표 · 그림 · 키 매크로 · 메일머지': 'HWPX open/save · HWP open (converted to HWPX) · DOCX/PDF export · Tables · Images · Key macros · Mail merge',
    '칸 블록 (네모 범위)': 'Column Block (Rectangle)', '칸 블록을 끝냈습니다.': 'Column block ended.',
    '칸 블록: 방향키·Shift+클릭으로 범위를 넓히세요. Ctrl+C 복사, Ctrl+X 오려 두기, Delete 지우기, Esc/F4 끝': 'Column block: extend with arrows or Shift+click. Ctrl+C copy, Ctrl+X cut, Delete delete, Esc/F4 end',
    '개체 묶기': 'Group Objects', '개체 풀기': 'Ungroup', '풀 묶음 개체를 선택하세요.': 'Select a group to ungroup.',
    '묶을 개체를 Ctrl(또는 Shift)을 누른 채 두 개 이상 누르세요.': 'Ctrl+click (or Shift+click) two or more objects to group them.',
    '도형 안에 글자 넣기': 'Add Text in Shape', '도형 안 글자 고치기': 'Edit Text in Shape', '선에는 글자를 넣을 수 없습니다.': 'Lines cannot contain text.',
    '탭': 'Tab', '탭 설정…': 'Tabs…', '탭 설정': 'Tabs', '탭 넣기': 'Add Tab', '탭 지우기': 'Remove Tab', '탭 채울 모양': 'Tab Leader', '모든 탭 지우기': 'Clear All Tabs',
    '왼쪽': 'Left', '가운데': 'Center', '오른쪽': 'Right', '위치': 'Position', '종류': 'Type', '채울 모양': 'Leader', '탭 추가': 'Add tab', '지우기': 'Delete',
    '실선 ─────': 'Solid ─────', '파선 - - - -': 'Dashed - - - -', '점선 ·········': 'Dotted ·········', '긴 파선 — — —': 'Long dash — — —', '이중 실선 ═════': 'Double ═════',
    '이 탭 지우기': 'Remove This Tab', '탭을 지웠습니다.': 'Tab removed.', '놓으면 탭을 지웁니다': 'Release to remove the tab', '탭을 넣을 문단에 커서를 두세요.': 'Put the cursor in a paragraph first.',
    '위치는 본문(또는 셀) 왼쪽 끝에서부터 잽니다. 눈금자를 마우스 오른쪽 단추로 눌러도 탭을 넣을 수 있고, 눈금자의 탭 표시를 끌어 옮기거나 눈금자 밖으로 끌어내 지울 수 있습니다.': 'Positions are measured from the left edge of the text area (or cell). You can also right-click the ruler to add tabs, drag tab marks to move them, or drag them off the ruler to remove them.',
    '탭 (끌어서 옮기기, 눈금자 밖으로 끌어내면 지우기, 오른쪽 단추: 채울 모양)': 'Tab (drag to move, drag off to remove, right-click: leader)',
    '눈금자 (오른쪽 단추: 탭 넣기, 두 번 누르면 문단 모양)': 'Ruler (right-click: add tab, double-click: paragraph format)',
    // 찾기
    '아래로': 'Down', '위로': 'Up', '찾을 내용': 'Find what', '바꿀 내용': 'Replace with', '찾을 방향': 'Direction', '대소문자 구별': 'Match case',
    '온전한 낱말': 'Whole word', '조건식 사용': 'Use regular expression', '다음 찾기': 'Find Next', '바꾸기': 'Replace', '모두 바꾸기': 'Replace All',
    '닫기': 'Close', '찾아 바꾸기': 'Find and Replace', '닫기 (Esc)': 'Close (Esc)', '확인': 'OK', '취소': 'Cancel', '설정': 'Apply', '저장 안 함': "Don't Save",
    // 대화상자
    '글자 모양': 'Character Format', '기준 크기': 'Size', '자간': 'Spacing', '음영 사용': 'Use shading', '음영 색': 'Shading color', '속성': 'Attributes',
    '문단 모양': 'Paragraph Format', '정렬 방식': 'Alignment', '왼쪽 여백': 'Left margin', '오른쪽 여백': 'Right margin', '첫 줄 (들여쓰기+/내어쓰기−)': 'First line (indent + / hanging −)',
    '문단 위': 'Space before', '문단 아래': 'Space after', '사용자 정의 (직접 입력)': 'Custom (enter size)', '편집 용지 (F7)': 'Page Setup (F7)', '용지 종류': 'Paper',
    '폭': 'Width', '길이': 'Height', '용지 방향': 'Orientation', '세로': 'Portrait', '가로': 'Landscape', '용지 여백': 'Margins', '위쪽': 'Top', '아래쪽': 'Bottom',
    '왼쪽': 'Left', '오른쪽': 'Right', '머리말': 'Header', '꼬리말': 'Footer', '용지 이름으로 저장': 'Save paper as', '예: 주보 용지 (비워 두면 저장 안 함)': 'e.g. Bulletin paper (leave empty to skip)',
    '고른 ★ 용지를 목록에서 지우기': 'Remove selected ★ paper from list', '이 용지·여백을 새 문서 기본값으로': 'Use this paper and margins for new documents', '저장': 'Save',
    '용지 종류를 고르면 폭과 길이가 바뀝니다. 폭·길이를 직접 고치고 이름을 넣으면 ★ 사용자 정의 용지로 저장되어 다음부터 목록에 나옵니다.': 'Choosing a paper sets width and height. Enter your own size and a name to save it as a ★ custom paper in the list.',
    '새 문서 기본 용지·여백으로 저장했습니다.': 'Saved as the default paper and margins for new documents.', '용지 목록을 고쳤습니다.': 'Paper list updated.',
    '줄 개수': 'Rows', '칸 개수': 'Columns', '첫 줄 제목 칸': 'Header row', '칸을 클릭하면 바로 만들어집니다.': 'Click a cell to create the table right away.', '표 만들기': 'Create Table', '만들기': 'Create',
    '셀 테두리/배경': 'Cell Border/Fill', '배경색 사용': 'Use fill color', '배경색': 'Fill color', '테두리': 'Border', '테두리 적용': 'Apply border', '바꾸지 않음': 'No change',
    '모두': 'All', '바깥쪽만 (선택 셀 전체 기준)': 'Outside only (selection)', '없음': 'None', '선 종류': 'Line style', '실선': 'Solid', '파선': 'Dashed', '점선': 'Dotted',
    '이중선': 'Double', '굵기': 'Width', '선 색': 'Line color', '정렬': 'Alignment', '세로 정렬': 'Vertical align', '가운데': 'Center', '위': 'Top', '아래': 'Bottom', '표 위치': 'Table position',
    '그림 속성': 'Picture Properties', '너비': 'Width', '높이': 'Height', '비율 유지': 'Keep aspect ratio', '배치': 'Layout', '글자처럼 취급': 'In line with text',
    '어울림 (왼쪽)': 'Wrap (left)', '어울림 (오른쪽)': 'Wrap (right)', '자리 차지 (가운데)': 'Top and bottom (center)', '글 앞으로 (자유 이동)': 'In front of text (free move)',
    '글 뒤로 (자유 이동)': 'Behind text (free move)', '원래 크기로': 'Reset to original size',
    '기호': 'Symbols', '문장 부호': 'Punctuation', '원/괄호 문자': 'Enclosed', '로마/그리스': 'Roman/Greek', '단위': 'Units', '선 문자': 'Box drawing', '문자표 (Ctrl+F10)': 'Symbols (Ctrl+F10)',
    '쪽 번호 매기기': 'Page Numbers', '번호 위치': 'Position', '쪽 번호 없음': 'No page number', '위 왼쪽': 'Top left', '위 가운데': 'Top center', '위 오른쪽': 'Top right',
    '아래 왼쪽': 'Bottom left', '아래 가운데': 'Bottom center', '아래 오른쪽': 'Bottom right', '줄표 넣기 ( - 1 - )': 'Add dashes ( - 1 - )', '넣기': 'Insert',
    '쪽 번호는 인쇄/PDF와 HWPX·DOCX 파일에 반영됩니다.': 'Page numbers appear in print/PDF and in HWPX/DOCX files.', '머리말/꼬리말': 'Header/Footer', '비워 두면 없음': 'Leave empty for none',
    '머리말 정렬': 'Header alignment', '꼬리말 정렬': 'Footer alignment', '머리말/꼬리말은 모든 쪽에 같게 들어가며 인쇄·PDF·파일에 반영됩니다.': 'The header/footer is the same on every page and appears in print, PDF and files.',
    '줄/칸 추가하기 (Alt+Insert)': 'Insert Rows/Columns (Alt+Insert)', '추가할 곳': 'Where', '아래쪽에 줄 추가': 'Row below', '위쪽에 줄 추가': 'Row above', '왼쪽에 칸 추가': 'Column left',
    '개수': 'Count', '추가': 'Insert', '줄/칸 지우기 (Alt+Delete)': 'Delete Rows/Columns (Alt+Delete)', '지울 대상': 'Delete', '줄': 'Rows', '칸': 'Columns', '지우기': 'Delete',
    '셀 블록이 있으면 블록이 걸친 줄/칸을 모두 지웁니다.': 'With a cell block, all rows/columns it covers are deleted.', '셀 나누기': 'Split Cell', '나누기': 'Split',
    '합쳐진 셀은 줄 1, 칸 1로 나누면 원래 모양으로 풀립니다.': 'Split a merged cell into 1 row × 1 column to unmerge it.', '찾아가기 (Alt+G)': 'Go To (Alt+G)', '쪽 번호': 'Page number', '가기': 'Go',
    '표 안 / 셀 블록 상태': 'In a table / cell block', '다음/이전 셀로 이동 (마지막 셀에서 Tab: 줄 추가)': 'Next/previous cell (Tab in last cell adds a row)', 'Ctrl+Enter (표 안)': 'Ctrl+Enter (in table)',
    '셀 블록 (두 번: 확장, 세 번: 표 전체)': 'Cell block (twice: extend, three times: whole table)', '셀 높이/너비를 같게': 'Equal heights/widths', 'Ctrl+방향키': 'Ctrl+Arrows',
    '셀 크기 조절 (표 크기도 바뀜)': 'Resize cells (table size changes)', 'Alt+방향키': 'Alt+Arrows', '셀 크기 조절 (표 전체 크기는 그대로)': 'Resize cells (table size kept)', 'Shift+방향키': 'Shift+Arrows',
    'F5 두 번 + 방향키': 'F5 twice + Arrows', '셀 블록 넓히기': 'Extend cell block', '셀 블록 해제': 'Cancel cell block', '아래아한글 단축키 체계를 따르는 가벼운 문서 편집기': 'A lightweight word processor with Hangul (HWP) shortcuts',
    '색 없음': 'No color', '테마 색': 'Theme colors', '기본 색': 'Standard colors', '최근에 쓴 색': 'Recent colors', '다른 색…': 'More colors…',
    // 매크로
    '매크로 정의 (키 매크로 기록)': 'Record Keyboard Macro', '매크로 번호': 'Macro slot', '매크로 이름': 'Macro name', '기록 시작': 'Start Recording',
    '기록을 시작한 뒤 글자 입력, 방향키, 서식·표 명령 등을 수행하세요. Alt+Shift+H를 다시 누르면 기록이 끝나고 저장됩니다.': 'After starting, type text and use arrow keys, format and table commands. Press Alt+Shift+H again to stop and save.',
    '(비어 있음)': '(empty)', '반복 횟수': 'Repeat', '매크로 실행 (Alt+Shift+L)': 'Run Macro (Alt+Shift+L)', '실행': 'Run', '이름 바꾸기': 'Rename', '매크로 이름 바꾸기': 'Rename Macro',
    '이름': 'Name', '편집': 'Edit', '매크로 편집 (고급)': 'Edit Macro (Advanced)', '동작 목록': 'Steps', '기록된 동작이 없어 매크로를 저장하지 않았습니다.': 'Nothing was recorded, so the macro was not saved.',
    '매크로 기록을 취소했습니다.': 'Macro recording canceled.', '매크로 기록 중에는 실행할 수 없습니다.': 'Cannot run a macro while recording.',
    'text: 글자 입력, input: Enter/지우기, nav: 커서 이동, cmd: 명령. 형식을 지켜 수정하세요.': 'text: typing, input: Enter/delete, nav: cursor moves, cmd: commands. Keep the format when editing.',
    // 메일머지
    '메일머지 표시 달기 (Ctrl+K,M)': 'Insert Mail Merge Field (Ctrl+K,M)', '필드 선택': 'Field', '(직접 입력)': '(type below)', '필드 이름/번호': 'Field name/number',
    '자료의 필드 이름(예: 이름, 주소) 또는 필드 번호(1, 2, …)를 입력하세요. 문서에는 {{이름}} 처럼 표시됩니다.': 'Enter a field name from the data (e.g. Name, Address) or a field number (1, 2, …). It appears as {{Name}} in the document.',
    '선택된 자료 없음': 'No data selected', '새 문서 (화면)': 'New document (screen)', 'HWPX 파일로 저장': 'Save as HWPX file', 'PDF 파일로 저장': 'Save as PDF file',
    '자료 파일 선택…': 'Choose data file…', '열린 문서에서 고르기…': 'Choose an open document…', '(열린 다른 문서 없음)': '(no other open documents)', '자료 종류': 'Data source',
    '고른 자료': 'Selected data', '출력 방향': 'Output', '만들 범위': 'Rows to merge', '번째 줄부터': 'from row', '번째 줄까지': 'to row', '자료 사이': 'Between rows', '쪽 나누기 (한 사람에 한 쪽)': 'Page break (one page each)', '바로 이어서 (빈 줄 없이)': 'Continue (no blank line)', '빈 줄 한 줄 띄우기': 'One blank line',
    '메일머지 만들기 (Alt+M)': 'Mail Merge (Alt+M)', '먼저 자료 파일을 선택하세요.': 'Choose a data file first.', '만들 자료 줄이 없습니다.': 'No data rows to merge.',
    '메일머지 결과': 'Mail merge result', '메일머지 자료 문서 만들기': 'Create Mail Merge Data Document', '필드 이름 (쉼표로 구분)': 'Field names (comma separated)',
    '빈 줄 수': 'Empty rows', '메일머지 자료': 'Mail merge data',
    '새 창에 자료 입력용 표가 만들어집니다. 내용을 채운 뒤 HWPX로 저장하고, 메일머지 만들기(Alt+M)에서 자료로 선택하세요.': 'A data table opens in a new tab. Fill it in, then choose it (or its saved HWPX) in Mail Merge (Alt+M).',
    // 번호/글머리표
    '번호 모양': 'Number format', '앞 번호 목록에 이어': 'Continue previous list', '문단 번호 모양 (Ctrl+K,N)': 'Numbering Format (Ctrl+K,N)', '직접': 'Custom',
    '다른 문자': 'Other character', '(문자표의 기호도 붙여 넣을 수 있습니다)': '(you can paste any symbol)', '글머리표 모양': 'Bullet Style',
    // 알림
    '셀 블록(F5)을 먼저 지정하세요.': 'Select a cell block (F5) first.', '셀 블록 확장: 방향키로 범위를 넓히세요.': 'Cell block extend mode: use arrow keys.',
    '표 전체가 선택되어 있어 크기를 나눌 칸이 없습니다.': 'The whole table is selected; no column to take space from.', '표 전체가 선택되어 있어 크기를 나눌 줄이 없습니다.': 'The whole table is selected; no row to take space from.',
    '표 가장자리에 있는 셀은 셀만 따로 크기를 바꿀 수 없습니다. Ctrl+방향키를 쓰세요.': 'Edge cells cannot be resized alone. Use Ctrl+Arrows.', '합쳐진 이웃 셀 때문에 이 셀만 크기를 바꿀 수 없습니다.': 'A merged neighbor cell prevents resizing this cell alone.',
    '모양을 복사했습니다. 블록을 지정한 뒤 다시 Alt+C를 누르면 적용됩니다.': 'Format copied. Select text and press Alt+C again to apply.', '복사한 모양을 적용했습니다.': 'Copied format applied.',
    '첫 줄 시작 위치 (끌어서 들여쓰기/내어쓰기)': 'First line (drag to indent/outdent)', '왼쪽 여백 (끌어서 조절)': 'Left margin (drag)', '오른쪽 여백 (끌어서 조절)': 'Right margin (drag)',
    '눈금자 (두 번 누르면 문단 모양)': 'Ruler (double-click for paragraph format)', '커서가 낱말 위에 있지 않습니다.': 'The cursor is not on a word.', '선택한 글자가 없습니다.': 'Nothing is selected.',
    '한 문단 안의 글자만 모두 선택할 수 있습니다.': 'Only text within one paragraph can be used.', '되돌릴 내용이 없습니다.': 'Nothing to undo.', '다시 실행할 내용이 없습니다.': 'Nothing to redo.',
    '클립보드를 읽을 수 없습니다. Ctrl+V를 사용하세요.': 'Cannot read the clipboard. Use Ctrl+V.', 'DOCX로 내보냈습니다.': 'Exported to DOCX.', 'PDF로 저장했습니다.': 'Saved as PDF.',
    '설정했습니다. 인쇄·PDF·저장 파일에 반영됩니다.': 'Done. Applies to print, PDF and saved files.', '문서 끝부터 다시 찾았습니다. ': 'Wrapped from the end. ', '문서 처음부터 다시 찾았습니다. ': 'Wrapped from the start. ',
    '매크로 저장 실패: ': 'Failed to save macros: ', '필드를 찾지 못했습니다.': 'No fields found.', '필드를 찾지 못했습니다. 첫 줄이 필드 이름인 표를 넣어 주세요.': 'No fields found. Add a table whose first row has the field names.',
  },
  // 문장 틀 (숫자 등이 들어가는 문구)
  rules: [
    [/^(.+)을\(를\) HWPX로 바꿔 불러왔습니다\. 저장하면 HWPX 파일로 저장됩니다\.$/, '$1 was converted to HWPX and opened. Saving writes an HWPX file.'],
    [/^기본 글꼴을 (.+) ([\d.]+)pt로 정했습니다\.$/, 'Default font set to $1 $2pt.'],
    [/^(\d+)\/(\d+)쪽$/, 'Page $1/$2'],
    [/^(\d+)쪽$/, 'p. $1'],
    [/^문단 (\S+) · (\d+)칸(?: · 셀 (\S+))?$/, (m, a, b, c) => `Para ${a} · Col ${b}${c ? ' · Cell ' + c : ''}`],
    [/^글자 (\d+) \(공백 제외 (\d+)\)$/, 'Chars $1 (no spaces $2)'],
    [/^빈 문서 (\d+)( \*)?$/, 'Untitled $1$2'],
    [/^(.*) \(편집 중인 문서\)$/, (m, a) => `${I18N.t(a)} (editing)`],
    [/^셀 블록 (\d+)개 .*$/, 'Cell block: $1 cells (M merge · S split · L border/fill · H/W equalize · F7 column · F8 row · Ctrl/Alt/Shift+Arrows resize)'],
    [/^커서 (\d+)개 .*$/, '$1 cursors (typing, deleting and arrows apply to all · Esc to exit)'],
    [/^"(.*)" (\d+)곳을 모두 선택했습니다\.$/, 'Selected all $2 occurrences of "$1".'],
    [/^저장했습니다: (.*)$/, 'Saved: $1'],
    [/^(.*)을\(를\) 불러왔습니다\.$/, 'Opened $1.'],
    [/^(.*)모두 (\d+)곳$/, (m, a, b) => I18N.t(a) + `${b} matches`],
    [/^(\d+)개를 바꾸었습니다\.$/, 'Replaced $1.'],
    [/^"(.*)"을\(를\) 찾을 수 없습니다\.$/, 'Cannot find "$1".'],
    [/^'(.*)'은\(는\) 지금 사용할 수 없습니다\.$/, (m, a) => `"${I18N.t(a)}" is not available here.`],
    [/^● 매크로 기록 중 \((\d+)\)$/, '● Recording macro ($1)'],
    [/^필드 (\d+)개 · 자료 줄 (\d+)개( · 필드 이름 줄 없음\(첫 줄부터 자료, 필드 번호로 연결\))?(?: · 자료에 없는 필드: (.*))?$/, (m, a, b, n, c) => `Fields ${a} · Data rows ${b}` + (n ? ' · no field-name row (data starts at the first row, matched by field number)' : '') + (c ? ` · missing in data: ${c}` : '')],
    [/^자료 (\d+)줄로 새 문서를 만들었습니다\.$/, 'Created a new tab from $1 data rows.'],
    [/^(왼쪽|가운데|오른쪽) 탭 넣기 \((.*)\)$/, (m, a, b) => `Add ${I18N.t(a)} Tab (${b})`],
    [/^(왼쪽|가운데|오른쪽) 탭 \((.*)\)$/, (m, a, b) => `${I18N.t(a)} tab (${b})`],
    [/^(왼쪽|가운데|오른쪽) 탭으로 바꾸기$/, (m, a) => `Change to ${I18N.t(a)} Tab`],
    [/^채울 모양: (.*)$/, (m, a) => `Leader: ${I18N.t(a)}`],
    [/^새 탭의 채울 모양: (.*)$/, (m, a) => `Leader for new tabs: ${I18N.t(a)}`],
    [/^이 쪽에서 (.*)을\(를\) 감춥니다\.$/, (m, a) => `Hiding ${a.split('·').map((x) => I18N.t(x)).join(', ')} on this page.`],
    [/^(\d+)쪽$/, 'Page $1'],
    [/^이 쪽부터 쪽 번호를 (\d+)\(으\)로 새로 시작합니다\.$/, 'Page numbering restarts at $1 from this page.'],
    [/^칸 블록 (\d+)줄 \(.*\)$/, 'Column block: $1 lines (Ctrl+C copy · Ctrl+X cut · Delete · Esc end)'],
    [/^칸 블록 (\d+)줄을 복사했습니다\..*$/, 'Copied a column block of $1 lines. Pasting puts each line in the same column from the cursor down.'],
    [/^개체 (\d+)개를 골랐습니다\. Ctrl\+G: 개체 묶기$/, '$1 objects selected. Ctrl+G: group'],
    [/^개체 (\d+)개를 묶었습니다\. \(풀기: Ctrl\+Shift\+G\)$/, 'Grouped $1 objects. (Ungroup: Ctrl+Shift+G)'],
    [/^묶음을 풀었습니다\. \(개체 (\d+)개\)$/, 'Ungrouped ($1 objects).'],
    [/^마우스로 끌어서 (.+)을\(를\) 그리세요\. .*$/, (m, a) => `Drag with the mouse to draw a ${I18N.t(a).toLowerCase()}. Just click to insert the default size. (Esc: cancel)`],
    [/^(.+?)  \((Ctrl\+\d)\)$/, (m, a, b) => `${I18N.t(a)}  (${b})`],
    [/^(Alt\+Shift\+\d)  — (.*)$/, (m, a, b) => `${a}  — ${b === '비어 있음' ? 'empty' : b.replace(' (덮어쓰기)', ' (overwrite)')}`],
    [/^매크로 (\d+) 실행$/, 'Run macro $1'],
    [/^스타일: (.*)$/, (m, a) => `Style: ${I18N.t(a)}`],
    [/^— 비어 있음$/, '— empty'],
    [/^동작 (\d+)$/, '$1 steps'],
    [/^'(.*)' 문서가 바뀌었습니다\. 저장할까요\?$/, "'$1' has changed. Save it?"],
    [/^(.*) - 누리글$/, (m, a) => `${I18N.t(a)} - Nurigeul`],
    [/^(.*) \* - 누리글$/, (m, a) => `${I18N.t(a)} * - Nurigeul`],
    [/^"(.*)" 매크로를 저장했습니다 \((.*), 동작 (\d+)개\)\.$/, 'Saved macro "$1" ($2, $3 steps).'],
    [/^매크로 기록을 시작합니다\..*$/, 'Macro recording started. Press Alt+Shift+H to stop.'],
    [/^(.*)에 해당하는 명령이 없습니다\.$/, 'No command for $1.'],
    [/^조건식이 올바르지 않습니다: (.*)$/, 'Invalid regular expression: $1'],
  ],
  // 긴 안내문 안의 문장 조각
  fragments: [
    ['자료로 쓸 수 있는 파일: ① 첫 줄이 필드 이름인 표가 든 한글(HWPX) 문서 ② 한글 메일머지 자료 형식(첫 줄에 필드 개수, 다음 줄부터 자료를 한 줄에 하나씩. 필드 이름 줄은 넣어도 되고 빼도 됨) 문서 ③ CSV/탭 구분 텍스트.', 'Usable data: ① a Hangul (HWPX) document with a table whose first row holds the field names ② a Hangul mail-merge data file (field count on the first line, then one value per line; the field-name lines are optional) ③ CSV or tab-separated text.'],
    ['현재 문서의 필드: ', 'Fields in this document: '],
    ['현재 문서에 메일머지 표시가 없습니다. Ctrl+K,M으로 먼저 표시를 다세요.', 'This document has no merge fields yet. Insert them with Ctrl+K,M first.'],
    ['HWPX 열기/저장 · DOCX/PDF 내보내기 · 표 · 그림 · 키 매크로 · 메일머지', 'HWPX open/save · DOCX/PDF export · Tables · Pictures · Keyboard macros · Mail merge'],
    ['.hwp(바이너리) 파일은 한글에서 HWPX로 저장한 뒤 여세요.', 'For binary .hwp files, save them as HWPX in Hangul first.'],
    ['조건식 예: \\d+ (숫자) · [가-힣]+ (한글 낱말) · (주|월)요일 · ^제\\d+장 (문단 처음) · \\s{2,} (빈칸 여러 개). 바꿀 내용에 $1, $2로 괄호 부분을 쓸 수 있습니다.', 'Examples: \\d+ (numbers) · [A-Za-z]+ (words) · (Mon|Tue)day · ^Chapter \\d+ (paragraph start) · \\s{2,} (multiple spaces). Use $1, $2 in Replace with for groups.'],
    ['누리글 ', 'Nurigeul '],
  ],
  t(s) {
    if (this.lang !== 'en' || s == null) return s;
    const k = String(s);
    if (Object.prototype.hasOwnProperty.call(this.en, k)) return this.en[k];
    const tr = k.trim();
    if (tr !== k && Object.prototype.hasOwnProperty.call(this.en, tr)) return k.replace(tr, this.en[tr]);
    for (const [re, rep] of this.rules) if (re.test(k)) return k.replace(re, rep);
    let out = k;
    for (const [ko, en] of this.fragments) if (out.includes(ko)) out = out.split(ko).join(en);
    return out;
  },
  // 요소 안의 글자·툴팁을 한꺼번에 번역
  dom(root) {
    if (this.lang !== 'en' || !root) return root;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    const list = [];
    while ((n = w.nextNode())) {
      if (n.parentElement && n.parentElement.closest('#editor, .symgrid, .fmt-grid, .data-table, .keytable td.k, kbd, option[value^="c:"]')) continue;
      if (/[가-힣]/.test(n.nodeValue)) list.push(n);
    }
    list.forEach((t) => {
      const v = t.nodeValue;
      const tr = this.t(v.trim());
      if (tr !== v.trim()) t.nodeValue = v.replace(v.trim(), tr);
      else {
        // "파일(F)" 같은 메뉴 이름
        const m = /^(.+?)(\([A-Z]\))$/.exec(v.trim());
        if (m && this.en[m[1]]) t.nodeValue = this.en[m[1]] + m[2];
      }
    });
    root.querySelectorAll && root.querySelectorAll('[title], [placeholder]').forEach((el) => {
      for (const a of ['title', 'placeholder']) {
        const v = el.getAttribute(a);
        if (!v || !/[가-힣]/.test(v)) continue;
        const m = /^(.*)( \([^()]*\))$/.exec(v);
        let tr = this.t(v);
        if (tr === v && m) tr = this.t(m[1]) + m[2];
        el.setAttribute(a, tr);
      }
    });
    return root;
  },
};
const T = (s) => I18N.t(s);

const nconfirm = (msg, buttons, detail) => window.native.confirm(T(msg), (buttons || []).map(T), detail);

// 언어 바꾸기: 메뉴·도구 모음을 다시 만들고, 이후 새로 생기는 화면 글자는 자동 번역
I18N.setLang = function (lang, silent) {
  this.lang = lang === 'en' ? 'en' : 'ko';
  document.documentElement.lang = this.lang;
  if (window.native && window.native.setLang) window.native.setLang(this.lang);
  if (!silent) {
    App.saveSettings({ lang: this.lang });
    App.closeMenus();
    $('#menubar').innerHTML = '';
    $('#toolbar').innerHTML = '';
    $('#formatbar').innerHTML = '';
    App.buildMenubar();
    App.buildToolbars();
    App.fillFontSelect();
    App.updateToolbar();
    App.updateStatus();
    App.updateTitle();
    App.layout();
    App.toggleOverwrite(); App.toggleOverwrite();
    Macro.updateUI();
    status(this.lang === 'en' ? 'Language: English' : '언어: 한국어');
  }
  this.watch();
};
I18N.watch = function () {
  if (this._obs) { this._obs.disconnect(); this._obs = null; }
  if (this.lang !== 'en') return;
  const skip = (n) => { const ed = document.getElementById('editor'); return ed && (n === ed || ed.contains(n)); };
  this._obs = new MutationObserver((recs) => {
    const roots = new Set();
    for (const r of recs) {
      if (skip(r.target)) continue;
      const el = r.target.nodeType === 3 ? r.target.parentElement : r.target;
      if (el) roots.add(el);
    }
    roots.forEach((el) => this.dom(el));
  });
  this._obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder'] });
  this.dom(document.body);
};
