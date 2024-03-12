const addProcessForm = document.getElementById('add_process');
const solveForm = document.getElementById('print_graph');
const _waitingTime = document.getElementById('waiting_time');
const _systemTime = document.getElementById('system_time');
let Processes = [];
let lastId = 0;

class Process {
    constructor(id, phaseTime, arrivalTime) {
        this.id = id;
        this.phaseTime = phaseTime;
        this.arrivalTime = arrivalTime;
    }
}

function addProcessRow(process) {
    if (Processes.length > 40) {
        alert("You reach the maximum limit for adding processes!");
        return;
    }

    const tableBody = document.querySelector('.processes__list tbody');
    const row = document.createElement('tr');
    row.classList.add('process');
    row.id = `process_${process.id}`;

    row.innerHTML = `
        <td>${process.id}</td>
        <td>${process.phaseTime}</td>
        <td>${process.arrivalTime}</td>
        <td><a href="#" data-process-id="${process.id}" class="button-delete">X</a></td>
    `;

    tableBody.appendChild(row);

    const deleteButton = row.querySelector('.button-delete');
    deleteButton.addEventListener('click', function (event) {
        event.preventDefault();
        const processId = this.getAttribute('data-process-id');
        const rowToDelete = document.getElementById(`process_${processId}`);

        Processes = Processes.filter(process => process.id != processId);

        rowToDelete.remove();
    });
}

function drawProcessGraph(algorithm) {
    const scrollContainer = document.querySelector('.scroll-container');
    scrollContainer.innerHTML = '';

    const margin = { top: 20, right: 30, bottom: 30, left: 40 },
        width = 800 - margin.left - margin.right,
        height = 20 * Processes.length;

    const svg = d3.select(".scroll-container").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().range([0, width]);
    const y = d3.scaleBand().range([height, 0]).padding(0.1);

    let currentTime = 0;
    let waitingTime = 0;
    let systemTime = 0;

    let processesToSchedule = Processes.slice(); // Deep Copy Processess Array
    processesToSchedule.sort((a, b) => a.arrivalTime - b.arrivalTime); // Sort by arrival time for both FIFO and SJF

    while (processesToSchedule.length > 0) {
        let process = null;

        if (algorithm === 'SJF') {
            // For SJF, find the process with the shortest phase time among those that have arrived
            let availableProcesses = processesToSchedule.filter(p => p.arrivalTime <= currentTime);
            if (availableProcesses.length === 0) {
                currentTime = Math.min(...processesToSchedule.map(p => p.arrivalTime));
                availableProcesses = processesToSchedule.filter(p => p.arrivalTime <= currentTime);
            }
            process = availableProcesses.reduce((prev, current) => prev.phaseTime < current.phaseTime ? prev : current);
        } else {
            // For FIFO, simply select the first process in the sorted list
            process = processesToSchedule.find(p => p.arrivalTime <= currentTime) || processesToSchedule[0];
        }

        // Schedule the selected process
        process.startTime = Math.max(currentTime, process.arrivalTime);
        process.endTime = process.startTime + process.phaseTime;
        currentTime = process.endTime;
        process.waitingTime = process.startTime - process.arrivalTime;
        waitingTime += process.waitingTime;
        systemTime += process.endTime - process.arrivalTime;

        // Remove the scheduled process from the list
        processesToSchedule = processesToSchedule.filter(p => p.id !== process.id);
    }

    x.domain([0, currentTime]);
    y.domain(Processes.map(d => d.id));

    svg.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append("g")
        .attr("class", "axis axis--y")
        .call(d3.axisLeft(y));

    Processes.forEach((d, i) => {
        svg.append("rect")
            .attr("y", y(d.id))
            .attr("x", x(d.startTime))
            .attr("height", y.bandwidth())
            .attr("width", x(d.phaseTime) - x(0))
            .attr("fill", "steelblue");
    });

    _waitingTime.innerText = (waitingTime / Processes.length).toFixed(2);
    _systemTime.innerText = (systemTime / Processes.length).toFixed(2);
}

function drawRoundRobin(qValue) {
    const scrollContainer = document.querySelector('.scroll-container');
    scrollContainer.innerHTML = '';

    const margin = { top: 20, right: 30, bottom: 30, left: 40 },
        width = 800 - margin.left - margin.right,
        height = 20 * Processes.length;

    const svg = d3.select(".scroll-container").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().range([0, width]);
    const y = d3.scaleBand().range([height, 0]).padding(0.1);

    let currentTime = 0;
    let waitingTime = 0;
    let systemTime = 0;
    let processesToSchedule = Processes.map(process => ({
        ...process,
        remainingTime: process.phaseTime,
        times: []
    }));

    while (processesToSchedule.some(p => p.remainingTime > 0)) {
        processesToSchedule.forEach(process => {
            if (process.arrivalTime <= currentTime && process.remainingTime > 0) {
                const duration = Math.min(process.remainingTime, qValue);
                process.times.push({ start: currentTime, duration });
                currentTime += duration;
                process.remainingTime -= duration;
            }
        });
    }

    // Calculate waiting and system times based on the updated times
    processesToSchedule.forEach(process => {
        let totalDuration = process.times.reduce((acc, time) => acc + time.duration, 0);
        let lastFinishTime = process.times[process.times.length - 1].start + process.times[process.times.length - 1].duration;
        waitingTime += lastFinishTime - process.arrivalTime - totalDuration;
        systemTime += lastFinishTime - process.arrivalTime;
    });

    x.domain([0, Math.max(...processesToSchedule.flatMap(p => p.times.map(t => t.start + t.duration)))]);
    y.domain(Processes.map(d => d.id));

    svg.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append("g")
        .attr("class", "axis axis--y")
        .call(d3.axisLeft(y));

    processesToSchedule.forEach(process => {
        process.times.forEach((time) => {
            svg.append("rect")
                .attr("y", y(process.id))
                .attr("x", x(time.start))
                .attr("height", y.bandwidth())
                .attr("width", x(time.duration) - x(0))
                .attr("fill", "steelblue");
        });
    });

    _waitingTime.innerText = (waitingTime / Processes.length).toFixed(2);
    _systemTime.innerText = (systemTime / Processes.length).toFixed(2);
}

addProcessForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);

    const arrivalTime = formData.get('arrivalTime');
    const phaseTime = formData.get('phaseTime');

    if(arrivalTime < 0 || phaseTime < 0){
        alert("Use Positive Values!");
        return;
    }

    if (arrivalTime > 3600 || phaseTime > 600) {
        alert(`Please use values less than 600 seconds for arrival time and less than 3600 seconds for phase time.`);
        return;
    }

    const newProcess = new Process(++lastId, +phaseTime, +arrivalTime);
    Processes.push(newProcess);
    addProcessRow(newProcess);
    addProcessForm.reset();
});

solveForm.addEventListener('submit', (e) => {
    e.preventDefault();

    if (Processes.length === 0) {
        alert("You must add processes!");
        return;
    }

    const formData = new FormData(e.target);
    const algorithm = formData.get('algorithm');
    const qValue = formData.get('Q-value');

    if(algorithm == "FIFO" || algorithm == "SJF")
        drawProcessGraph(algorithm, qValue);
    else
        drawRoundRobin(qValue);
});
