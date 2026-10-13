// Optional, bounded diagnostics. No coordinates, sequences, or network uploads.
(function () {
    'use strict';
    const diagnostics = {
        active: false, started: 0, ended: 0, stats: new Map(), slowEvents: [], samples: [],
        observer: null, timer: null, stopTimer: null, snapshot: () => ({}),
        record(name, duration, start = performance.now() - duration) {
            if (!this.active || !Number.isFinite(duration)) return;
            let stat = this.stats.get(name);
            if (!stat) this.stats.set(name, stat = {count: 0, totalMs: 0, maxMs: 0, over50ms: 0});
            stat.count++; stat.totalMs += duration; stat.maxMs = Math.max(stat.maxMs, duration);
            if (duration >= 50) {
                stat.over50ms++;
                if (this.slowEvents.length === 200) this.slowEvents.shift();
                this.slowEvents.push({stage: name, startMs: start - this.started, durationMs: duration});
            }
        },
        wrap(name, fn) {
            const monitor = this;
            return function (...args) {
                if (!monitor.active) return fn.apply(this, args);
                const start = performance.now(), session = monitor.started;
                let result;
                try { result = fn.apply(this, args); }
                finally { monitor.record(name, performance.now() - start, start); }
                if (result && typeof result.then === 'function') {
                    // Wall time includes asynchronous waits; it is not CPU time.
                    const done = () => { if (monitor.started === session) monitor.record(name + ' (async wall time)', performance.now() - start, start); };
                    result.then(done, done);
                }
                return result;
            };
        },
        frame() {
            if (!this.active) return;
            const now = performance.now();
            if (this.lastFrame && document.visibilityState === 'visible') this.record('visible frame interval (wall)', now-this.lastFrame, this.lastFrame);
            this.lastFrame = document.visibilityState === 'visible' ? now : 0;
        },
        sample() {
            if (!this.active) return;
            const memory = performance.memory;
            if (this.samples.length === 120) this.samples.shift();
            this.samples.push({atMs: performance.now() - this.started, visibility: document.visibilityState,
                heap: memory ? {usedBytes: memory.usedJSHeapSize, totalBytes: memory.totalJSHeapSize, limitBytes: memory.jsHeapSizeLimit} : null,
                ...this.snapshot()});
            this.update();
        },
        start() {
            this.stop(); this.stats.clear(); this.slowEvents = []; this.samples = [];
            this.started = performance.now(); this.ended = 0; this.lastFrame = 0; this.active = true;
            if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
                this.observer = new PerformanceObserver(list => {
                    for (const entry of list.getEntries()) if (entry.startTime >= this.started)
                        this.record('main-thread long task', entry.duration, entry.startTime);
                });
                this.observer.observe({type: 'longtask', buffered: false});
            }
            this.sample(); this.timer = setInterval(() => this.sample(), 1000);
            this.stopTimer = setTimeout(() => this.stop(), 60000); this.update();
        },
        stop() {
            if (this.active) {
                if (this.observer) for (const entry of this.observer.takeRecords())
                    if (entry.startTime >= this.started) this.record('main-thread long task', entry.duration, entry.startTime);
                this.sample(); this.ended = performance.now();
            }
            this.active = false; this.observer?.disconnect(); this.observer = null;
            clearInterval(this.timer); clearTimeout(this.stopTimer); this.update();
            if(this.started){
                const report=this.report(),data=document.getElementById('performanceReportData'),summary=document.getElementById('performanceRecordingSummary');
                if(data)data.value=JSON.stringify(report,null,2);
                if(summary)summary.textContent=report.stages.filter(stage=>!stage.name.includes('wall')&&stage.name!=='main-thread long task'&&stage.name!=='physics worker compute').slice(0,5)
                    .map(stage=>`${stage.name}: max ${stage.maxMs.toFixed(1)}ms, mean ${stage.meanMs.toFixed(1)}ms`).join('\n');
            }
        },
        report() {
            return {version: 1, durationMs: (this.ended || performance.now()) - this.started,
                browser: navigator.userAgent, longTasksSupported: typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask'),
                notes: ['Stage timings overlap; do not add them together.', 'Worker and async wall times include waiting, not just CPU work.',
                    'WebGL submission measures CPU time, not GPU execution.', 'Heap readings are optional and do not include all worker/GPU/native memory.',
                    'A main-thread stall delays recording callbacks until the page recovers.'],
                stages: [...this.stats].map(([name, stat]) => ({name, ...stat, meanMs: stat.totalMs / stat.count})).sort((a,b) => b.maxMs - a.maxMs),
                slowEvents: this.slowEvents.slice(), samples: this.samples.slice()};
        },
        download() {
            this.stop();
            const url = URL.createObjectURL(new Blob([JSON.stringify(this.report(), null, 2)], {type: 'application/json'}));
            const link = document.createElement('a'); link.href = url; link.download = 'stringscape-performance.json'; link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        update() {
            const button = document.getElementById('recordPerformanceBtn'), status = document.getElementById('performanceRecordingStatus'), download = document.getElementById('downloadPerformanceBtn');
            if (button) button.textContent = this.active ? 'Stop recording' : 'Record performance (60 seconds)';
            if (download) download.disabled = !this.started;
            if (status) {
                const tasks = this.stats.get('main-thread long task');
                status.textContent = this.active ? `Recording: ${Math.round((performance.now()-this.started)/1000)}s · ${tasks?.count || 0} long tasks` : this.started ? 'Recording saved in this page. Download the report.' : 'Start before reproducing a stall. The report stays on your computer.';
            }
        }
    };
    window.AppPerformanceDiagnostics = diagnostics;
})();
