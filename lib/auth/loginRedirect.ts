const NEXT_PARAM = 'next';

function isSafeInternalPath(path: string | null): path is string {
  // Chỉ nhận đường dẫn trong site; "//x" và "/\x" sẽ bị trình duyệt hiểu là tên miền khác.
  return Boolean(path && path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\'));
}

/** URL trang đăng nhập, kèm trang hiện tại để đăng nhập xong quay lại đúng chỗ. */
export function buildLoginUrl(): string {
  if (typeof window === 'undefined') return '/login';

  const { pathname, search } = window.location;
  if (pathname === '/' || pathname.startsWith('/login') || pathname === '/register') return '/login';

  return `/login?${NEXT_PARAM}=${encodeURIComponent(pathname + search)}`;
}

/** Trang cần mở sau khi đăng nhập, lấy từ tham số next trên URL. */
export function getPostLoginPath(): string {
  if (typeof window === 'undefined') return '/';

  const next = new URLSearchParams(window.location.search).get(NEXT_PARAM);
  return isSafeInternalPath(next) ? next : '/';
}

/** Giữ nguyên tham số next khi chuyển qua lại giữa các trang đăng nhập. */
export function withLoginNext(path: string): string {
  const next = getPostLoginPath();
  return next === '/' ? path : `${path}?${NEXT_PARAM}=${encodeURIComponent(next)}`;
}
