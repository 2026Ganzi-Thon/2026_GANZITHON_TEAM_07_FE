import { artworkLight, artworkMaterial, deformArtwork, SHEEP_RECT } from './artworkDeformation';
import type { ArtworkRect } from '../../lib/toyArtwork';
import type { ArtworkPose } from './artworkDeformation';

const COLS = 24, ROWS = 16;
const meshPoints = (rect: ArtworkRect, cols = COLS, rows = ROWS) => Array.from({ length: (cols + 1) * (rows + 1) }, (_, i) => {
  const u = i % (cols + 1) / cols, v = Math.floor(i / (cols + 1)) / rows;
  return { x: rect.x + u * rect.width, y: rect.y + v * rect.height, u, v };
});
const meshIndices = (cols: number, rows: number) => new Uint16Array(Array.from({ length: cols * rows }, (_, i) => {
  const a = Math.floor(i / cols) * (cols + 1) + i % cols, b = a + 1, c = a + cols + 1, d = c + 1;
  return [a, c, b, b, c, d];
}).flat());
const indices = meshIndices(COLS, ROWS);
export interface ArtworkRenderer { kind: 'webgl' | 'canvas'; draw: (pose: ArtworkPose) => void; dispose: () => void }

/** A single textured mesh, not a 3D reconstruction of the supplied photograph. */
export function createArtworkRenderer(canvas: HTMLCanvasElement, image: HTMLImageElement | HTMLCanvasElement, forceCanvas = false, rect: ArtworkRect = SHEEP_RECT): ArtworkRenderer | null {
  if (forceCanvas) return createCanvasRenderer(canvas, image, rect);
  const points = meshPoints(rect);
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
  if (!gl) return createCanvasRenderer(canvas, image, rect);
  const shaders: WebGLShader[] = [];
  function shader(type: number, source: string) {
    const result = gl!.createShader(type)!; shaders.push(result);
    gl!.shaderSource(result, source); gl!.compileShader(result);
    if (!gl!.getShaderParameter(result, gl!.COMPILE_STATUS)) throw new Error('Artwork shader compilation failed');
    return result;
  }
  const program = gl.createProgram()!;
  const vertex = `attribute vec4 a_vertex; varying vec2 v_uv;
    void main(){gl_Position=vec4(a_vertex.x/150.0-1.0,1.0-a_vertex.y/145.0,0.0,1.0);v_uv=a_vertex.zw;}`;
  const fragment = `precision mediump float; varying vec2 v_uv;
    uniform vec4 u_rect; uniform sampler2D u_image; uniform vec2 u_anchor; uniform float u_depth; uniform float u_shadow; uniform float u_radius;
    void main(){
      if(u_shadow>0.5){
        vec2 d=(v_uv-vec2(0.5,0.795))/vec2(0.32+u_depth*0.025,0.028-u_depth*0.004);
        float a=exp(-dot(d,d)*2.3)*(0.055+u_depth*0.015);
        gl_FragColor=vec4(vec3(0.30,0.26,0.23)*a,a);
      }else{
        vec4 color=texture2D(u_image,v_uv); if(color.a<0.025) discard;
        vec2 p=(u_rect.xy+v_uv*u_rect.zw)-u_anchor;
        float q=dot(p,p)/(u_radius*u_radius);
        float bowl=exp(-q/2.0), rim=exp(-q/4.5);
        float slope=u_depth*(26.0*bowl-5.0*rim/2.25)/(u_radius*u_radius);
        vec3 normal=normalize(vec3(-p*slope,1.0));
        float light=clamp(1.0+(dot(normal,vec3(-0.45,-0.6,0.66))-0.66)*0.40-u_depth*0.045*bowl,0.85,1.10);
        gl_FragColor=vec4(min(color.rgb*light,vec3(color.a)),color.a);
      }
    }`;
  try {
    gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex)); gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment)); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Artwork shader linking failed');
  } catch {
    shaders.forEach(value => gl.deleteShader(value)); gl.deleteProgram(program); return null;
  }
  const buffer = gl.createBuffer()!, indexBuffer = gl.createBuffer()!, texture = gl.createTexture()!;
  const vertices = new Float32Array(points.length * 4);
  const quad = new Float32Array([0, 0, 0, 0, 0, 290, 0, 1, 300, 0, 1, 0, 300, 290, 1, 1]);
  gl.useProgram(program); gl.uniform4f(gl.getUniformLocation(program, 'u_rect'), rect.x, rect.y, rect.width, rect.height);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const location = gl.getAttribLocation(program, 'a_vertex'); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 4, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  gl.bindTexture(gl.TEXTURE_2D, texture); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const anchor = gl.getUniformLocation(program, 'u_anchor'), depth = gl.getUniformLocation(program, 'u_depth'), shadow = gl.getUniformLocation(program, 'u_shadow'), radius = gl.getUniformLocation(program, 'u_radius');
  return { kind: 'webgl', draw(pose) {
    gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(anchor, pose.anchor.x, pose.anchor.y); gl.uniform1f(depth, pose.depth);
    gl.uniform1f(radius, artworkMaterial(pose.shape).radius);
    gl.uniform1f(shadow, 1); gl.bufferData(gl.ARRAY_BUFFER, quad, gl.DYNAMIC_DRAW); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    points.forEach((p, i) => { const moved = deformArtwork(p, pose); vertices.set([moved.x, moved.y, p.u, p.v], i * 4); });
    gl.uniform1f(shadow, 0); gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW); gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
  }, dispose() { gl.deleteBuffer(buffer); gl.deleteBuffer(indexBuffer); gl.deleteTexture(texture); gl.deleteProgram(program); shaders.forEach(value => gl.deleteShader(value)); } };
}

// Same local deformation on devices without WebGL; do not replace it with a fake animation.
function createCanvasRenderer(canvas: HTMLCanvasElement, image: HTMLImageElement | HTMLCanvasElement, rect: ArtworkRect): ArtworkRenderer | null {
  // Canvas clips each triangle separately. A coarser grid keeps software rendering responsive.
  const points = meshPoints(rect, 12, 8), indices = meshIndices(12, 8);
  const ctx = canvas.getContext('2d'); if (!ctx) return null;
  const texture = document.createElement('canvas'); texture.width = 450; texture.height = 300;
  const textureContext = texture.getContext('2d')!;
  textureContext.drawImage(image, 0, 0, 450, 300);
  const lighting = document.createElement('canvas'); lighting.width = 96; lighting.height = 96;
  const lightContext = lighting.getContext('2d')!, pixels = lightContext.createImageData(96, 96);
  return { kind: 'canvas', draw(pose) {
    ctx.setTransform(canvas.width / 300, 0, 0, canvas.height / 290, 0, 0); ctx.clearRect(0, 0, 300, 290);
    ctx.save(); ctx.translate(150, 230); ctx.scale(1, .08);
    const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, 95); shadow.addColorStop(0, '#4d423b12'); shadow.addColorStop(1, '#4d423b00');
    ctx.fillStyle = shadow; ctx.fillRect(-95, -95, 190, 190); ctx.restore();
    textureContext.clearRect(0, 0, 450, 300); textureContext.drawImage(image, 0, 0, 450, 300);
    if (Math.abs(pose.depth) < .0001 && Math.hypot(pose.pull.x, pose.pull.y) < .01) { ctx.drawImage(texture, rect.x, rect.y, rect.width, rect.height); return; }
    const radius = artworkMaterial(pose.shape).radius;
    for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
      const light = artworkLight(rect.x + (x + .5) / 96 * rect.width - pose.anchor.x, rect.y + (y + .5) / 96 * rect.height - pose.anchor.y, pose.depth, radius);
      const offset = (y * 96 + x) * 4, bright = light > 1;
      pixels.data[offset] = pixels.data[offset + 1] = pixels.data[offset + 2] = bright ? 255 : 0;
      pixels.data[offset + 3] = Math.round(Math.abs(light - 1) * (bright ? 1.5 : 1) * 255);
    }
    lightContext.putImageData(pixels, 0, 0);
    textureContext.globalCompositeOperation = 'source-atop';
    textureContext.drawImage(lighting, 0, 0, 450, 300);
    textureContext.globalCompositeOperation = 'source-over';
    const moved = points.map(point => deformArtwork(point, pose));
    for (let i = 0; i < indices.length; i += 3) {
      const ids = [indices[i], indices[i + 1], indices[i + 2]];
      const [a, b, c] = ids.map(id => points[id]), [p, q, r] = ids.map(id => moved[id]);
      const sx1 = b.u * 450 - a.u * 450, sy1 = b.v * 300 - a.v * 300;
      const sx2 = c.u * 450 - a.u * 450, sy2 = c.v * 300 - a.v * 300, det = sx1 * sy2 - sx2 * sy1;
      const aa = ((q.x - p.x) * sy2 - (r.x - p.x) * sy1) / det;
      const bb = ((q.y - p.y) * sy2 - (r.y - p.y) * sy1) / det;
      const cc = ((r.x - p.x) * sx1 - (q.x - p.x) * sx2) / det;
      const dd = ((r.y - p.y) * sx1 - (q.y - p.y) * sx2) / det;
      // Cover subpixel clip seams between adjacent textured triangles.
      const center = { x: (p.x + q.x + r.x) / 3, y: (p.y + q.y + r.y) / 3 };
      const clip = [p, q, r].map(point => {
        const dx = point.x - center.x, dy = point.y - center.y, length = Math.hypot(dx, dy);
        return { x: point.x + dx / length * .65, y: point.y + dy / length * .65 };
      });
      ctx.save(); ctx.beginPath(); ctx.moveTo(clip[0].x, clip[0].y); ctx.lineTo(clip[1].x, clip[1].y); ctx.lineTo(clip[2].x, clip[2].y); ctx.closePath(); ctx.clip();
      ctx.transform(aa, bb, cc, dd, p.x - aa * a.u * 450 - cc * a.v * 300, p.y - bb * a.u * 450 - dd * a.v * 300);
      ctx.drawImage(texture, 0, 0); ctx.restore();
    }
  }, dispose() { texture.width = 0; texture.height = 0; lighting.width = 0; } };
}
