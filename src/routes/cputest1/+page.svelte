<script lang='ts'>

import {onMount} from "svelte";



function runCpuBenchmark(iterations = 10_000_000) {
  return new Promise((resolve, reject) => {
    const workerSource = `
      self.onmessage = ({ data }) => {
        const iterations = data.iterations;

        let value = 0x12345678;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
          value = Math.imul(value ^ i, 0x45d9f3b);
          value ^= value >>> 13;
        }

        const elapsedMs = performance.now() - start;

        self.postMessage({
          elapsedMs,
          checksum: value
        });
      };
    `;

    const url = URL.createObjectURL(
      new Blob([workerSource], { type: "text/javascript" })
    );

    const worker = new Worker(url);

    worker.onmessage = event => {
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(event.data.elapsedMs);
    };

    worker.onerror = error => {
      worker.terminate();
      URL.revokeObjectURL(url);
      reject(error);
    };

    worker.postMessage({ iterations });
  });
}

async function measureCpu() {
  // Multiple runs reduce noise from JIT compilation and background work.
  const samples = [];

  for (let i = 0; i < 3; i++) {
    samples.push(await runCpuBenchmark());
  }

  samples.sort((a, b) => a - b);
  return samples[1]; // Median
}

let score: number = null;


onMount(() => {

    measureCpu()
    .then(
        (x) => {
            score = x;
            console.log(score);
        }
    )

})

</script>

<p>score: {score}</p>