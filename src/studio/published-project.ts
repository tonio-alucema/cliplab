import snapshot from './defaults/tonio-set-02.cliplab.json'
import { parseProject, upgradeStudioDefaults, type Project } from './model'

/** Every new studio gets its own editable copy of the published project. */
export function publishedProject(): Project {
  return parseProject(snapshot)
}

/** Publishing a new default must never overwrite a visitor's saved work. */
export function loadStudioProject(saved: string | null): Project {
  return saved === null ? publishedProject() : upgradeStudioDefaults(parseProject(JSON.parse(saved)))
}
