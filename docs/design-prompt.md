# UI 디자인 요청 프롬프트

아래 내용을 디자인 AI(v0.dev, Figma AI 등)에 그대로 붙여넣어 사용하세요.

---

## 프롬프트

You are a UI designer who specializes in clean, minimal web interfaces.

Design a single-page web app with the following requirements.

---

### Service Overview

A web service that finds a user's **first submission**, **first accepted submission**, or **first wrong answer** on Baekjoon Online Judge (BOJ), a Korean competitive programming platform.

---

### Service Name

```
my first boj
```

---

### Headline Copy

```
나의 첫 백준은?
```

Sub-copy (small, below headline):
```
나의 첫 제출 내역을 확인해보세요.
```

---

### Page Layout

Single page, centered content. Content area should be narrow and compact — not full-width. Max width around 480–560px, horizontally centered.

**Do NOT include:**
- No sidebar
- No top navigation bar / header nav
- No decorative or illustrative images of any kind (no code screenshots, no blurred backgrounds, no stock photos)

#### 1. Header (top-left)
- Service name (`my first boj`) only. Small, clean. No navigation links.

#### 2. Mode Selector (3 tabs)
- `첫 제출` (First Submission)
- `첫 정답` (First Accepted)
- `첫 오답` (First Wrong Answer)

Tab-style selector with underline indicator on active tab. Active tab has a visible underline (e.g. blue bottom border). Inactive tabs are muted. No pill/capsule shape — flat tab with bottom border only.

#### 3. Input Area
- Single centered text input
- placeholder: `백준 아이디를 입력하세요`
- Button below: `찾아보기`
- When the user submits, the input area (text input + button) disappears entirely and is replaced by the result or loading state in the same vertical position

#### 4. Loading State
- Replaces the input area after submission
- Thin progress bar (0~100%), width matches where the input was
- Small label below: `탐색 중...` with percentage

#### 5. Result Card
- Replaces the input area after loading completes — shown in the same region
- Include a small `다시 찾아보기` text link or minimal button below the card to reset the view back to the input state
- A clean card showing:

| Field | Example |
|-------|---------|
| Submission ID | #12345678 |
| Problem | 1000 |
| Submitted At | 2019년 3월 14일 오후 10:31 |
| Language | C++17 |
| Result | 맞았습니다!! / 틀렸습니다 / 출력 형식이 잘못되었습니다 / ... |

Result label colors (pill/badge style):

| Result | Color |
|--------|-------|
| 맞았습니다!! | `#009874` |
| 출력 형식이 잘못되었습니다 | `#fa7268` |
| 틀렸습니다 | `#dd4124` |
| 시간 초과 | `#fa7268` |
| 메모리 초과 | `#fa7268` |
| 출력 초과 | `#fa7268` |
| 런타임 에러 | `#5f4b8b` |
| 컴파일 에러 | `#0f4c81` |

- Each result is shown as a colored text label or small pill badge matching the color above
- No decorative quotes or phrases on the card

---

### Design Direction

**Tone**: Light, clean, functional. Similar to the BOJ website's bright white tone.

**Color Palette**:
- Background: pure white or very light gray (`#f9f9f9`)
- Primary accent: BOJ blue (`#3d7de4` range) or neutral dark
- Text: dark gray, not black
- No dark mode

**Typography**:
- All sans-serif. No serif fonts, no calligraphic fonts.
- Keep font sizes small and modest — this is a utility tool, not a landing page
- Headline: bold or semi-bold, but not oversized. Around 24–28px max.
- Body / labels: small, around 13–14px
- Sub-copy: muted, around 13px

**Layout**:
- Generous whitespace — empty space is intentional and good
- No illustrations, no background images, no decorative elements, no images of any kind
- No motivational quotes or literary phrases anywhere on the page
- Keep it sparse and functional
- All content horizontally centered, within a narrow max-width container

**Border Radius**:
- Do NOT use rounded corners on any buttons, inputs, cards, tabs, or dropdowns
- All components should have sharp, square corners (border-radius: 0 or at most 2px)
- This applies to every interactive and container element on the page

**References**: BOJ (acmicpc.net), solved.ac — same bright, utility-first aesthetic.
