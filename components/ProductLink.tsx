'use client';

import type { ComponentProps } from 'react';

export function ProductLink(props: ComponentProps<'a'> & { href: string }) {
  function countClick() {
    const id = props.href.split('/').pop() ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(id)) return;
    void fetch('/api/product-click', { method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {});
  }
  return <a {...props} onClick={countClick} onAuxClick={event => { if (event.button === 1) countClick(); }} />;
}
