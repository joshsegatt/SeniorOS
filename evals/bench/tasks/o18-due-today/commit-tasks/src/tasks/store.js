/**
 * In-memory task store (production uses the same interface over Postgres).
 * @typedef {{ id: string, owner: string, title: string, dueDate: string | null, done: boolean, source: 'app' | 'email', createdAt: string }} Task
 */
export function createTaskStore() {
  /** @type {Task[]} */
  const tasks = [];
  let seq = 0;
  return {
    nextId() {
      seq += 1;
      return `t-${seq}`;
    },
    /** @param {Task} task */
    insert(task) {
      tasks.push({ ...task });
      return { ...task };
    },
    /** @param {string} id @param {Partial<Task>} patch */
    update(id, patch) {
      const found = tasks.find((t) => t.id === id);
      if (!found) throw new Error(`unknown task ${id}`);
      Object.assign(found, patch);
      return { ...found };
    },
    /** @param {string} owner */
    forOwner(owner) {
      return tasks.filter((t) => t.owner === owner).map((t) => ({ ...t }));
    },
  };
}
