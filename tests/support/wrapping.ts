import { expect, type Page } from '@playwright/test';

export async function expectWholeKoreanWords(page: Page, selector: string) {
  const split = await page.locator(selector).evaluateAll(elements => {
    const broken: string[] = [];
    for (const element of elements) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        for (const match of (node.textContent ?? '').matchAll(/[^\s]+/gu)) {
          if (!/^[가-힣]{2,12}[.!?]?$/u.test(match[0])) continue;
          const range = document.createRange();
          range.setStart(node, match.index!); range.setEnd(node, match.index! + match[0].length);
          const lines = new Set([...range.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.y)));
          if (lines.size > 1) broken.push(match[0]);
        }
      }
    }
    return broken;
  });
  expect(split).toEqual([]);
}
