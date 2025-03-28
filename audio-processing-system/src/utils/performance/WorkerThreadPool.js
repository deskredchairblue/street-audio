// src/utils/performance/WorkerThreadPool.js

const { Worker } = require('worker_threads');
const path = require('path');

class WorkerThreadPool {
  constructor({ minThreads = 2, maxThreads = 4 }) {
    this.minThreads = minThreads;
    this.maxThreads = maxThreads;
    this.workers = [];
    this.queue = [];
    this.idle = [];

    for (let i = 0; i < minThreads; i++) {
      this.spawnWorker();
    }
  }

  spawnWorker() {
    const worker = new Worker(path.join(__dirname, 'worker.js')); // placeholder worker
    worker.on('message', (result) => {
      const { resolve } = worker.currentTask;
      resolve(result);
      this.idle.push(worker);
      this.runNext();
    });
    worker.on('error', (err) => console.error('Worker error:', err));
    this.idle.push(worker);
    this.workers.push(worker);
  }

  run(taskData) {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskData, resolve, reject });
      this.runNext();
    });
  }

  runNext() {
    if (this.queue.length === 0 || this.idle.length === 0) return;

    const worker = this.idle.shift();
    const task = this.queue.shift();
    worker.currentTask = task;
    worker.postMessage(task.taskData);
  }

  shutdown() {
    this.workers.forEach(worker => worker.terminate());
  }
}

module.exports = WorkerThreadPool;
