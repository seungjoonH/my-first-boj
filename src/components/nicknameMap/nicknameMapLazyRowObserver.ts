const ROOT_MARGIN = '300px 0px 420px 0px';

let sharedIo: IntersectionObserver | null = null;
const callbacks = new Map<Element, () => void>();

function getSharedIo(): IntersectionObserver {
  if (sharedIo) return sharedIo;
  sharedIo = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const fn = callbacks.get(entry.target);
        if (!fn) continue;
        callbacks.delete(entry.target);
        sharedIo!.unobserve(entry.target);
        fn();
      }
    },
    { root: null, rootMargin: ROOT_MARGIN, threshold: 0.01 },
  );
  return sharedIo;
}

/** 한 인스턴스의 IO로 모든 지연 행 등록 — 행마다 Observer 생성 방지 */
export function observeNicknameMapLazyRow(el: Element, onVisible: () => void): () => void {
  const io = getSharedIo();
  callbacks.set(el, onVisible);
  io.observe(el);
  return () => {
    callbacks.delete(el);
    io.unobserve(el);
  };
}
