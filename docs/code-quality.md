# Prova 코드 품질 규칙

> 이 문서에 정의된 규칙은 **프로젝트 전체에 적용**되며, 리뷰·PR·AI 보조 작업 모두 이 기준을 따릅니다.

---

## 0. 핵심 철학

모든 리팩토링과 설계의 목적은 **읽기 쉬운 코드**다.

> "이 코드를 처음 보는 사람이 맥락 없이 이해할 수 있는가?"

### 읽기 쉬운 코드의 기준

- **의도가 드러난다**: 이름과 구조만으로 목적이 보인다
- **맥락이 유지된다**: 관련 로직은 가깝고, 무관한 것은 분리된다
- **예측 가능하다**: 일반적인 기대를 벗어나지 않는다
- **단위가 작다**: 한 번에 이해 가능한 크기다

---

## 1. 코드 구조 원칙

### 1.1 조건 분기

**규칙**
- 열거형/타입 기반 분기는 `switch` 사용
- 중첩 조건은 early return으로 평탄화

```typescript
// ❌
if (type === 'A') { ... }
if (type === 'B') { ... }

// ✅
switch (type) {
  case 'A': ...
  case 'B': ...
}
```

```typescript
// ❌
if (a) {
  if (b) {
    doSomething();
  }
}

// ✅
if (!a) return;
if (!b) return;
doSomething();
```

### 1.2 조건식 단순화

**규칙**
- 조건이 3개 이상이면 의미 있는 변수로 추출
- null 체크는 optional chaining 사용

```typescript
// ✅
const isValidTarget = node instanceof Node && ref.current?.contains(node);
if (isValidTarget) { ... }
```

### 1.3 함수는 최대한 작게

**규칙**
- 한 줄이면 한 줄로 작성
- 하나의 함수는 하나의 책임만

```typescript
// ✅
const close = () => setOpen(false);
```

### 1.4 매직 넘버 금지

**규칙**
- 의미 없는 숫자/문자열 직접 사용 금지
- 반드시 이름 있는 상수로 추출

```typescript
// ✅
const RETRY_INTERVAL_MS = 300;
```

### 1.5 JSX / View 레이어 규칙

**규칙**
- 렌더 내부에서 로직 실행 금지
- 복잡한 로직은 렌더 이전에 계산

```tsx
// ❌
{(() => compute())()}

// ✅
const result = compute();
```

### 1.6 반복/변환

**규칙**
- `map` / `filter` 우선 사용
- 성능상 필요할 때만 `for` 사용

### 1.7 컴포넌트/모듈 크기

다음 조건이면 분리한다:
- 상태가 많다
- 사이드이펙트가 많다
- 이벤트 핸들러가 많다
- UI 블록이 여러 개다

| 대상 | 분리 방법 |
|---|---|
| 상태/로직 | custom hook |
| UI 블록 | 하위 컴포넌트 |
| 데이터 처리 | service/module |

### 1.8 사이드 이펙트

**규칙**
- 하나의 effect = 하나의 책임

```typescript
// ❌
useEffect(() => {
  fetch();
  addEventListener();
}, []);

// ✅
useEffect(fetch, []);
useEffect(bindEvent, []);
```

---

## 2. 코드 정리 원칙

### 2.1 import 정리

- 항상 최상단
- 선언과 섞지 않음

### 2.2 미사용 코드 제거

즉시 제거 대상:
- unused import
- unused 변수
- unused export
- 빈 파일

### 2.3 데이터 구조 통합

**규칙**
- 같은 키를 공유하는 데이터는 하나의 객체로 통합

```typescript
// ❌
const labels = {};
const icons = {};

// ✅
const META = {
  key: { label, icon }
};
```

### 2.4 우회 금지

문제 해결 순서:
1. 실패 원인 파악
2. 근본 원인 해결
3. 단순한 수정 적용

**금지**
- fallback 남발
- try-catch로 숨기기
- 환경 분기로 우회

---

## 3. 네이밍 원칙

### 3.1 이벤트 핸들러

`handleXxx` 사용

```
handleClick
handleSubmit
```

### 3.2 불리언

`is` / `has` / `can` 접두사

```
isVisible
hasError
```

### 3.3 의미 기반 네이밍

```typescript
// ❌
data, temp, value

// ✅
userList, retryCount
```

---

## 4. 스타일링 원칙

### 4.1 CSS Modules 패턴

모든 스타일은 `.module.css` 파일에 정의한다. TSX에 인라인 스타일을 작성하지 않는다.

```tsx
// ✅
function Component({ label }: ComponentProps) {
  return <div className={styles.root}>{label}</div>;
}
```

```css
.root {
  /* 스타일 */
}
```

className 조합에는 `buildCls` 유틸리티를 사용한다.

```ts
// src/lib/buildCls.ts
export function buildCls(...args: (string | false | null | undefined)[]) {
  return args.filter(Boolean).join(' ').trim();
}
```

`buildCls`를 JSX 속성에 인라인으로 호출하지 않는다. 반드시 변수로 추출한다.

```tsx
// ❌
<div className={buildCls(styles.root, active && styles.active)} />

// ✅
const className = buildCls(styles.root, active && styles.active);
<div className={className} />
```

`buildCls`에 인자가 하나뿐이라면 `buildCls`를 쓰지 않고 직접 사용한다.

```tsx
// ❌
const className = buildCls(styles.root);
<div className={className} />

// ✅
<div className={styles.root} />
```

### 4.2 동적 값 처리

동적 CSS 값이 필요한 경우 CSS 변수로 전달하고, `.module.css`에서 소비한다.
JSX `style` prop에 CSS 속성값(opacity, transform 등)을 직접 넣지 않는다.

```tsx
// ❌
<div style={{ opacity: value, transition: 'opacity 0.3s' }} />

// ✅
<div style={{ '--opacity': value } as React.CSSProperties} />
```

```css
.root {
  opacity: var(--opacity, 1);
  transition: opacity 0.3s;
}
```

### 4.3 컴포넌트 캡슐화

- 컴포넌트는 자신의 스타일을 완전히 소유한다
- 커스텀 컴포넌트에 `className`·`style` prop을 두지 않는다
- 외부에서 스타일 조정이 필요하면 래퍼 요소에 클래스를 붙인다

```tsx
// ❌
<ResultBadge result="ac" className={styles.badge} />

// ✅
<span className={styles.badge}><ResultBadge result="ac" /></span>
```

예외: `style={{ '--css-var': value }}` CSS 변수 전달은 허용한다.

### 4.4 SVG는 파일로 분리

JSX 안에 `<svg>` 태그를 인라인으로 작성하지 않는다.
`public/` 디렉토리에 `.svg` 파일로 저장하고 `<img>`로 사용한다.

```tsx
// ❌
<svg viewBox="0 0 24 24"><path d="..." /></svg>

// ✅
<img src="/icons/search.svg" alt="" aria-hidden="true" />
```

---

## 5. 컴포넌트 API 설계

### 5.1 최소 API

- 하나의 값으로 유추 가능한 prop은 제거

### 5.2 단일 진입점

- 같은 기능을 여러 방식으로 제공 금지

### 5.3 Variant 타입 패턴

배경색·크기 등을 직접 prop으로 받지 않는다.
미리 정의된 variant를 타입으로 제한하여 임의의 값 사용을 막는다.

```tsx
type ResultVariant = 'ac' | 'wa' | 'tle' | 'mle' | 'ce' | 're';

interface ResultBadgeProps {
  result: ResultVariant;
}
```

```css
.badge.ac  { color: #009874; }
.badge.wa  { color: #cc3333; }
.badge.tle { color: #e06c00; }
```

### 5.4 Base 컴포넌트 + Named Export 패턴

variant가 여러 개인 컴포넌트는 `*Base`를 내부 구현으로 두고,
variant가 고정된 Named Export를 외부에 제공한다.

```tsx
// 내부 — export 안 함
function ButtonBase({ variant, ...props }: ButtonProps) {
  const cls = [styles.button, styles[variant]].filter(Boolean).join(' ');
  return <button className={cls} {...props} />;
}

// 외부에 공개
export function PrimaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <ButtonBase {...props} variant="primary" />;
}

export function GhostButton(props: Omit<ButtonProps, 'variant'>) {
  return <ButtonBase {...props} variant="ghost" />;
}
```

### 5.5 타입 정의 파일 분리

컴포넌트의 타입은 같은 디렉토리의 `type.ts`에 분리한다.

```
components/
└── resultBadge/
    ├── ResultBadge.tsx
    ├── resultBadge.module.css
    └── type.ts
```

---

## 6. 성능 원칙

### 6.1 최적화 최소화

다음 경우에만 사용:
- 비용 큰 연산
- 참조 안정성 필요

```typescript
// ❌
useMemo(() => a + b)

// ✅
const result = a + b;
```

---

## 7. 에러 처리

**규칙**
- 예측 가능한 에러는 사전에 차단
- 에러는 숨기지 않고 드러낸다

```typescript
// ✅
if (!response.ok) throw new Error();
```

---

## 8. 접근성 원칙

W3C "Using ARIA" 4가지 규칙을 따른다. 위반 시 코드 리뷰를 통과하지 못한다.

### 1st Rule — native 요소 우선

native HTML 요소로 의미와 동작을 표현할 수 있다면 ARIA를 쓰지 않는다.

```tsx
// ❌
<div role="list"><div role="listitem">...</div></div>
<div role="dialog">...</div>

// ✅
<ul><li>...</li></ul>
<dialog open>...</dialog>
```

예외: native 요소를 쓸 수 없는 경우에만 ARIA를 허용한다.
- `<button>` 안에 `<a>` 또는 `<button>`이 중첩될 때 → `<div role="button">`
- 동적 SVG 인라인 삽입처럼 native 요소가 없을 때 → `<span role="img">`

### 2nd Rule — native 의미를 덮어쓰지 않는다

```tsx
// ❌
<h2 role="tab">탭 제목</h2>

// ✅
<div role="tab"><h2>탭 제목</h2></div>
```

### 3rd Rule — interactive ARIA 컨트롤은 키보드로 조작 가능해야 한다

`role="button"` 등 interactive role이 있는 요소는 반드시:
- `tabIndex={0}` 으로 포커스 가능
- `onKeyDown`에서 Enter/Space 처리

```tsx
// ❌
<div role="button" onClick={handleClick}>클릭</div>

// ✅
<div role="button" tabIndex={0} onClick={handleClick} onKeyDown={handleKeyDown}>클릭</div>
```

### 4th Rule — focusable 요소에 aria-hidden 금지

```tsx
// ❌
<button aria-hidden="true">클릭</button>

// ✅ (포커스 불가 상태일 때만)
<button tabIndex={-1} aria-hidden="true">클릭</button>
```

---

## 9. 데이터 설계 원칙

### 핵심: "UI 로직을 데이터로 표현한다"

```typescript
// ❌
if (type === 'special') { ... }

// ✅
if (item.isSpecial) { ... }
```

### 예외 처리 방식

예외가 생기면:
- 코드 분기 추가 ❌
- 데이터 구조 수정 ⭕

```typescript
// ✅
{
  type: 'project',
  status: 'deprecated'
}
```

**금지**: 범용 규칙에 프로젝트 특화 로직 포함

---

## 10. Prova 언어 확장 규칙

### 10.1 언어 비교는 `is()` 유틸리티를 사용한다

**위치**: `src/lib/language.ts`

```typescript
import { lang } from "@/lib/language";

// ✅
if (lang(language).js)   { ... }
if (lang(language).py)   { ... }
if (lang(language).java) { ... }

// ❌ 문자열 리터럴 직접 비교
if (language === "javascript") { ... }
if (language === "python")     { ... }
```

이유:
- 언어 식별자 오타를 컴파일 타임에 잡을 수 있다
- 새 언어를 추가할 때 `is()` 반환 객체 한 곳만 수정하면 타입 에러로 누락을 탐지한다

적용 범위: `.ts`, `.tsx` 파일 전체. 단, `src/lib/language.ts` 내부 구현 코드는 예외.

### 10.2 언어 분기는 `switch`로 작성한다

언어별로 다른 로직을 실행해야 할 때, `if / else if` 체인 대신 `switch (language)`를 사용한다.

```typescript
// ✅
switch (language) {
  case "javascript":
    break;
  case "java":
    break;
  default:
    // Python
}

// ❌
if (language === "javascript") { ... }
else if (language === "java")  { ... }
else { ... }
```

예외: 단일 조건 체크(`if (lang(language).js) return ...`)는 단문 `if`로 작성해도 무방하다.

### 10.3 새 언어 추가 시 체크리스트

| 파일 | 확인 내용 |
|---|---|
| `src/lib/language.ts` | `is()` 반환 객체에 새 키 추가 |
| `src/features/execution/runtime.ts` | `switch (this.language)` 케이스 추가 |
| `app/page.tsx` | `isRuntimeNoiseVar`, `collectUserDeclaredSymbols` switch 케이스 추가 |
| `app/api/analyze/route.ts` | `langLabel`, `langSpecificHints` switch 케이스 추가, fallback 패턴 추가 |

---

## 11. 최종 체크리스트

코드 작성 전 반드시 확인:

**구조**
- [ ] 읽는 사람이 이해 가능한가?
- [ ] 불필요한 분기가 있는가?
- [ ] 매직 넘버가 있는가?
- [ ] 중첩 조건이 있는가?
- [ ] 로직이 JSX 안에 있는가?
- [ ] 컴포넌트가 너무 큰가?
- [ ] effect가 여러 역할을 하는가?
- [ ] 불필요한 최적화가 있는가?
- [ ] 데이터로 표현 가능한 로직을 코드로 처리하고 있지 않은가?

**스타일링**
- [ ] JSX `style` prop에 CSS 속성값이 직접 들어가 있지 않은가? (CSS 변수만 허용)
- [ ] `buildCls`를 JSX 속성에 인라인으로 쓰지 않고 변수로 추출했는가?
- [ ] `buildCls` 인자가 하나뿐이라면 `styles.xxx`를 직접 사용했는가?
- [ ] 커스텀 컴포넌트에 `className`·`style` prop이 없는가?
- [ ] JSX 안에 인라인 `<svg>`가 없는가?

**컴포넌트 설계**
- [ ] variant/size를 임의 값이 아닌 타입으로 제한했는가?
- [ ] variant가 여러 개라면 Base + Named Export 패턴을 적용했는가?
- [ ] 컴포넌트 타입은 `type.ts`에 분리했는가?
- [ ] prop 중 한 값으로 다른 값을 유추할 수 있는 중복 prop이 없는가?

**정리**
- [ ] 사용하지 않는 import·export가 없는가?
- [ ] 구조분해에서 실제로 쓰이지 않는 항목이 없는가?
- [ ] 빈 파일이 남아 있지 않은가?

**접근성**
- [ ] native HTML 요소로 대체 가능한 ARIA role이 없는가?
- [ ] interactive role에 `tabIndex`와 `onKeyDown`이 있는가?
- [ ] focusable 요소에 `aria-hidden`이 붙어 있지 않은가?

---

## 개정 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-11 | 언어 비교 규칙 (`is()` 유틸, `switch`) 초안 작성 |
| 2026-04-11 | 핵심 철학·코드 구조·네이밍·접근성·데이터 설계 등 전체 규칙 추가 |
