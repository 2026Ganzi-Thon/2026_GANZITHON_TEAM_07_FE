import type { WaxCrop } from './customWax';

export function pngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve,reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('사진을 처리하지 못했어요.')), 'image/png'));
}
export async function readWaxImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob), image = new Image();
  try { image.src = url; await image.decode(); return image; }
  catch { throw new Error('이 사진을 열지 못했어요. JPG, PNG, WebP 사진을 골라 주세요.'); }
  finally { URL.revokeObjectURL(url); }
}
export async function prepareWaxPhoto(file: File): Promise<Blob> {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('JPG, PNG, WebP 사진을 골라 주세요.');
  if (file.size > 12 * 1024 * 1024) throw new Error('12MB 이하의 사진을 골라 주세요.');
  const image = await readWaxImage(file);
  if (image.naturalWidth * image.naturalHeight > 32_000_000) throw new Error('사진 해상도가 너무 커요. 크기를 줄여 다시 골라 주세요.');
  const ratio = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return pngBlob(canvas);
}
export function photoBounds(image: HTMLImageElement) {
  const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(image,0,0);
  const pixels = ctx.getImageData(0,0,canvas.width,canvas.height).data;
  let left=canvas.width, top=canvas.height, right=-1, bottom=-1, transparent=0, opaque=0;
  for(let y=0;y<canvas.height;y++) for(let x=0;x<canvas.width;x++) {
    const a=pixels[(y*canvas.width+x)*4+3];
    if(a>80) { left=Math.min(left,x); right=Math.max(right,x); top=Math.min(top,y); bottom=Math.max(bottom,y); opaque++; }
    if(a<20) transparent++;
  }
  if(opaque<32) throw new Error('사진에 보이는 부분이 너무 적어요. 다른 사진을 골라 주세요.');
  return { left, top, width:right-left+1, height:bottom-top+1, transparent:transparent>canvas.width*canvas.height*.02 };
}
export function drawWaxPhoto(canvas: HTMLCanvasElement, image: HTMLImageElement, crop: WaxCrop, bounds: ReturnType<typeof photoBounds>) {
  canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d')!;
  if(crop.mode==='outline') {
    const ratio=472/Math.max(bounds.width,bounds.height), w=bounds.width*ratio,h=bounds.height*ratio;
    ctx.drawImage(image,bounds.left,bounds.top,bounds.width,bounds.height,(512-w)/2,(512-h)/2,w,h);
  } else {
    ctx.beginPath();ctx.arc(256,256,236,0,Math.PI*2);ctx.clip();ctx.fillStyle='#fff9f2';ctx.fillRect(0,0,512,512);
    const ratio=Math.max(472/image.naturalWidth,472/image.naturalHeight)*crop.zoom;
    const w=image.naturalWidth*ratio,h=image.naturalHeight*ratio;
    ctx.drawImage(image,20-(w-472)/2+crop.x*(w-472)/2,20-(h-472)/2+crop.y*(h-472)/2,w,h);
  }
}
