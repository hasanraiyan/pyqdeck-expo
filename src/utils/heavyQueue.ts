// Runs expensive block renders (SVG diagrams, Mermaid flowcharts) strictly one
// at a time, in the order they were queued (top to bottom of the note), so the
// JS thread never gets several multi-hundred-ms jobs back to back.
interface Task {
  run: () => Promise<unknown> | void;
  cancelled: boolean;
}

const GAP_MS = 40;
const TASK_TIMEOUT_MS = 8000;

const tasks: Task[] = [];
let running = false;
let holds = 0;

function pump() {
  if (running) return;
  setTimeout(() => {
    if (running || holds > 0) return;
    let task = tasks.shift();
    while (task && task.cancelled) task = tasks.shift();
    if (!task) return;
    running = true;
    const current = task;
    const finish = () => {
      running = false;
      setTimeout(pump, GAP_MS);
    };
    Promise.race([
      Promise.resolve().then(() => current.run()),
      new Promise((resolve) => setTimeout(resolve, TASK_TIMEOUT_MS)),
    ]).then(finish, finish);
  }, 0);
}

/** Queue a heavy job. Returns a cancel function (call it on unmount). */
export function enqueueHeavy(run: () => Promise<unknown> | void): () => void {
  const task: Task = { run, cancelled: false };
  tasks.push(task);
  pump();
  return () => {
    task.cancelled = true;
  };
}

/** Pause the queue (e.g. while the note's text is still being revealed). */
export function holdHeavyQueue(): () => void {
  holds++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds--;
    pump();
  };
}
