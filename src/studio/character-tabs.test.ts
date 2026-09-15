// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, type App } from 'vue'
import CharacterTabs from './CharacterTabs.vue'
import { defaultProject } from './model'
vi.mock('./CharacterThumb.vue', () => ({ default: { render: () => null } }))
let app: App
const characters = defaultProject().characters
function mount(count = characters.length) {
  const events = { select: vi.fn(), rename: vi.fn(), remove: vi.fn(), reorder: vi.fn() }
  const host = document.createElement('div'); document.body.append(host)
  app = createApp(() => h(CharacterTabs, { characters: characters.slice(0, count), selected: characters[0]!.id, onSelect: events.select, onRename: events.rename, onRemove: events.remove, onReorder: events.reorder }))
  app.mount(host)
  return { host, events }
}
afterEach(() => { app?.unmount(); document.body.innerHTML = '' })
async function click(el: Element) { (el as HTMLElement).click(); await nextTick() }
it('renames the menu target without selecting it, and supports cancelling edits', async () => {
  const { host, events } = mount()
  await click(host.querySelectorAll('.character-options')[1]!)
  await click(document.querySelector('[role="menuitem"]')!)
  const input = host.querySelector<HTMLInputElement>('input')!
  input.value = '  Sunny  '; input.dispatchEvent(new Event('input'))
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await nextTick()
  expect(events.rename).toHaveBeenCalledWith(characters[1]!.id, 'Sunny')
  expect(events.select).not.toHaveBeenCalled()
  await click(host.querySelectorAll('.character-options')[0]!)
  await click(document.querySelector('[role="menuitem"]')!)
  host.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await nextTick()
  expect(events.rename).toHaveBeenCalledTimes(1)
})
it('deletes the requested character and offers keyboard-accessible reordering', async () => {
  const { host, events } = mount()
  await click(host.querySelectorAll('.character-options')[1]!)
  await click(document.querySelectorAll('[role="menuitem"]')[1]!)
  expect(events.reorder).toHaveBeenCalledWith(characters[1]!.id, characters[0]!.id, false)
  await click(host.querySelectorAll('.character-options')[1]!)
  await click(document.querySelectorAll('[role="menuitem"]')[3]!)
  expect(events.remove).toHaveBeenCalledWith(characters[1]!.id)
})
it('prevents deleting the last character', async () => {
  const { host, events } = mount(1)
  await click(host.querySelector('.character-options')!)
  const remove = document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[3]!
  expect(remove.disabled).toBe(true); await click(remove)
  expect(events.remove).not.toHaveBeenCalled()
})
it('reorders only internal drags, using the target side without changing selection', async () => {
  const { host, events } = mount()
  const tabs = host.querySelectorAll<HTMLElement>('.saved-character')
  tabs[1]!.getBoundingClientRect = () => ({ left: 100, width: 100 } as DOMRect)
  tabs[1]!.dispatchEvent(new MouseEvent('drop', { clientX: 190, bubbles: true })); expect(events.reorder).not.toHaveBeenCalled()
  tabs[0]!.dispatchEvent(new Event('dragstart', { bubbles: true })); await nextTick()
  tabs[1]!.dispatchEvent(new MouseEvent('dragover', { clientX: 190, bubbles: true, cancelable: true })); await nextTick()
  expect(tabs[1]!.classList.contains('drop-after')).toBe(true)
  tabs[1]!.dispatchEvent(new MouseEvent('drop', { clientX: 190, bubbles: true })); await nextTick()
  expect(events.reorder).toHaveBeenCalledWith(characters[0]!.id, characters[1]!.id, true)
  expect(events.select).not.toHaveBeenCalled()
  expect(host.querySelector('.dragging')).toBeNull()
})
