import type { Context, Message } from '../features/chat/model';
import type { DiaryRecord, Inventory, Profile, ToyType } from '../lib/domain';
import { TOYS } from '../lib/domain';
export class PreviewStore {
  readonly profiles: Profile[] = [{ id: 'demo-a', nickname: '마음 산책자' }, { id: 'demo-b', nickname: '느긋한 오후' }];
  private user: Profile | null = null;
  private records = new Map<string, Map<string, DiaryRecord>>();
  private inventories = new Map<string, Inventory>();
  me() { return this.user; }
  login(id: string) { this.user = this.profiles.find(p => p.id === id) ?? null; return this.user; }
  logout() { this.user = null; }
  private owner() { if (!this.user) throw new Error('UNAUTHORIZED'); return this.user.id; }
  inventory() {
    const id = this.owner();
    if (!this.inventories.has(id)) this.inventories.set(id, { selected: 'SQUISHY', unlocked: Object.keys(TOYS) as ToyType[], name: TOYS.SQUISHY.name });
    return this.inventories.get(id)!;
  }
  select(type: ToyType) {
    const inventory = this.inventory();
    if (!Object.hasOwn(TOYS, type)) throw new Error('INVALID_TYPE');
    inventory.selected = type; inventory.name = TOYS[type].name; return inventory;
  }
  list() { return [...(this.records.get(this.owner())?.values() ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  get(id: string) { return this.records.get(this.owner())?.get(id); }
  save(id: string, context: Context, messages?: Message[]) {
    const owner = this.owner();
    const previous = this.get(id); if (previous) return previous;
    if (!context.primary || context.stage !== 'DONE') throw new Error('INVALID_RESULT');
    // PRD 6.2 candidate mapping, used only as a preview fixture, never as the production recommendation policy.
    const recommended: ToyType = ['분노', '스트레스'].includes(context.primary) ? 'WAKPPU' : ['속상함', '슬픔'].includes(context.primary) ? 'SQUISHY' : 'SLANGI';
    const situation = context.slots.OPEN;
    const record: DiaryRecord = { id, createdAt: new Date().toISOString(), context: structuredClone(context), recommended, ...(messages ? { messages: structuredClone(messages) } : {}),
      summary: situation ? `${situation.slice(0, 140)}${situation.length > 140 ? '…' : ''}` : `오늘 ${context.primary} 마음을 남겼어요.` };
    if (!this.records.has(owner)) this.records.set(owner, new Map());
    this.records.get(owner)!.set(id, record);
    return record;
  }
  delete(id: string) { return this.records.get(this.owner())?.delete(id) ?? false; }
}
export const store = new PreviewStore();
