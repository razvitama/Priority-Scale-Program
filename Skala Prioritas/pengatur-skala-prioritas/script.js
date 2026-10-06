const STORAGE_KEY = "skalaPrioritasTasks";

let tasks = JSON.parse(
    localStorage.getItem(STORAGE_KEY)
) || [];


// ================================
// ELEMENT
// ================================

const taskForm = document.getElementById("taskForm");

const taskId = document.getElementById("taskId");
const taskName = document.getElementById("taskName");
const deadline = document.getElementById("deadline");
const weight = document.getElementById("weight");
const description = document.getElementById("description");

const taskList = document.getElementById("taskList");
const archiveList = document.getElementById("archiveList");

const emptyMessage = document.getElementById("emptyMessage");
const emptyArchive = document.getElementById("emptyArchive");

const totalTasks = document.getElementById("totalTasks");
const activeTasks = document.getElementById("activeTasks");
const archivedTasks = document.getElementById("archivedTasks");

const submitButton = document.getElementById("submitButton");
const cancelEdit = document.getElementById("cancelEdit");

const sortDeadline = document.getElementById("sortDeadline");


// ================================
// SAVE LOCAL STORAGE
// ================================

function saveTasks() {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(tasks)
    );

}


// ================================
// RENDER
// ================================

function renderTasks() {

    taskList.innerHTML = "";
    archiveList.innerHTML = "";

    const active = tasks.filter(task => !task.archived);
    const archived = tasks.filter(task => task.archived);


    totalTasks.textContent = tasks.length;
    activeTasks.textContent = active.length;
    archivedTasks.textContent = archived.length;


    emptyMessage.style.display =
        active.length === 0 ? "block" : "none";

    emptyArchive.style.display =
        archived.length === 0 ? "block" : "none";


    active.forEach((task, index) => {

        taskList.appendChild(
            createTaskCard(task, index, false)
        );

    });


    archived.forEach((task) => {

        archiveList.appendChild(
            createTaskCard(task, null, true)
        );

    });

}


// ================================
// CREATE TASK CARD
// ================================

function createTaskCard(task, index, isArchived) {

    const card = document.createElement("div");

    let priorityClass = "priority-low";

    if (task.weight >= 70) {
        priorityClass = "priority-high";
    }
    else if (task.weight >= 40) {
        priorityClass = "priority-medium";
    }


    card.className =
        `task-card ${priorityClass} ${isArchived ? "archived" : ""}`;


    const overdue = isOverdue(task.deadline);


    card.innerHTML = `

        <div class="task-top">

            <div>

                <div class="task-title">
                    ${escapeHTML(task.name)}
                </div>

                ${
                    task.description
                    ? `
                    <div class="task-description">
                        ${escapeHTML(task.description)}
                    </div>
                    `
                    : ""
                }

            </div>


            ${
                !isArchived
                ? `
                <div class="move-buttons">

                    <button
                        onclick="moveTask('${task.id}', -1)">
                        ↑
                    </button>

                    <button
                        onclick="moveTask('${task.id}', 1)">
                        ↓
                    </button>

                </div>
                `
                : ""
            }

        </div>


        <div class="task-info">

            <span class="badge badge-weight">
                Bobot: ${task.weight}%
            </span>


            <span class="badge ${
                overdue
                ? "badge-overdue"
                : "badge-deadline"
            }">

                Deadline:
                ${formatDate(task.deadline)}

            </span>


            ${
                overdue && !isArchived
                ? `
                    <span class="badge badge-overdue">
                        Terlambat
                    </span>
                `
                : ""
            }

        </div>


        <div class="task-actions">

            ${
                !isArchived
                ? `
                    <button
                        class="btn btn-secondary"
                        onclick="editTask('${task.id}')">
                        Edit
                    </button>

                    <button
                        class="btn btn-archive"
                        onclick="archiveTask('${task.id}')">
                        Arsipkan
                    </button>
                `
                : `
                    <button
                        class="btn btn-success"
                        onclick="unarchiveTask('${task.id}')">
                        Kembalikan
                    </button>
                `
            }


            <button
                class="btn btn-danger"
                onclick="deleteTask('${task.id}')">
                Hapus
            </button>

        </div>

    `;


    return card;
}


// ================================
// ADD / EDIT TASK
// ================================

taskForm.addEventListener("submit", function(event) {

    event.preventDefault();


    const nameValue = taskName.value.trim();
    const deadlineValue = deadline.value;
    const weightValue = Number(weight.value);
    const descriptionValue = description.value.trim();


    if (!nameValue || !deadlineValue) {
        return;
    }


    // EDIT
    if (taskId.value) {

        const task = tasks.find(
            item => item.id === taskId.value
        );


        if (task) {

            task.name = nameValue;
            task.deadline = deadlineValue;
            task.weight = weightValue;
            task.description = descriptionValue;

        }

    }

    // TAMBAH
    else {

        const newTask = {

            id: Date.now().toString(),

            name: nameValue,

            deadline: deadlineValue,

            weight: weightValue,

            description: descriptionValue,

            archived: false

        };


        tasks.push(newTask);

    }


    saveTasks();

    renderTasks();

    resetForm();

});


// ================================
// EDIT
// ================================

function editTask(id) {

    const task = tasks.find(
        item => item.id === id
    );


    if (!task) {
        return;
    }


    taskId.value = task.id;

    taskName.value = task.name;

    deadline.value = task.deadline;

    weight.value = task.weight;

    description.value = task.description;


    submitButton.textContent = "Simpan Perubahan";

    cancelEdit.classList.remove("hidden");

    document
        .getElementById("formTitle")
        .textContent = "Edit Tugas";


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


// ================================
// CANCEL EDIT
// ================================

cancelEdit.addEventListener(
    "click",
    resetForm
);


function resetForm() {

    taskForm.reset();

    taskId.value = "";

    weight.value = 50;

    submitButton.textContent = "Tambah Tugas";

    cancelEdit.classList.add("hidden");

    document
        .getElementById("formTitle")
        .textContent = "Tambah Tugas";

}


// ================================
// DELETE
// ================================

function deleteTask(id) {

    const confirmed = confirm(
        "Apakah Anda yakin ingin menghapus tugas ini?"
    );


    if (!confirmed) {
        return;
    }


    tasks = tasks.filter(
        task => task.id !== id
    );


    saveTasks();

    renderTasks();

}


// ================================
// ARCHIVE
// ================================

function archiveTask(id) {

    const task = tasks.find(
        item => item.id === id
    );


    if (!task) {
        return;
    }


    task.archived = true;


    saveTasks();

    renderTasks();

}


// ================================
// UNARCHIVE
// ================================

function unarchiveTask(id) {

    const task = tasks.find(
        item => item.id === id
    );


    if (!task) {
        return;
    }


    task.archived = false;


    saveTasks();

    renderTasks();

}


// ================================
// MOVE TASK
// ================================

function moveTask(id, direction) {

    const activeTasksArray =
        tasks.filter(task => !task.archived);


    const currentIndex =
        activeTasksArray.findIndex(
            task => task.id === id
        );


    const newIndex =
        currentIndex + direction;


    if (
        currentIndex < 0 ||
        newIndex < 0 ||
        newIndex >= activeTasksArray.length
    ) {
        return;
    }


    const currentTask =
        activeTasksArray[currentIndex];

    const targetTask =
        activeTasksArray[newIndex];


    const currentOriginalIndex =
        tasks.findIndex(
            task => task.id === currentTask.id
        );


    const targetOriginalIndex =
        tasks.findIndex(
            task => task.id === targetTask.id
        );


    [
        tasks[currentOriginalIndex],
        tasks[targetOriginalIndex]
    ] = [
        tasks[targetOriginalIndex],
        tasks[currentOriginalIndex]
    ];


    saveTasks();

    renderTasks();

}


// ================================
// SORT DEADLINE
// ================================

sortDeadline.addEventListener(
    "click",
    function() {

        const activeTasks =
            tasks.filter(task => !task.archived);

        activeTasks.sort(
            (a, b) =>
                new Date(a.deadline) -
                new Date(b.deadline)
        );


        const archived =
            tasks.filter(task => task.archived);


        tasks = [
            ...activeTasks,
            ...archived
        ];


        saveTasks();

        renderTasks();

    }
);


// ================================
// DATE
// ================================

function formatDate(dateString) {

    const date = new Date(
        dateString + "T00:00:00"
    );


    return date.toLocaleDateString(
        "id-ID",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


function isOverdue(dateString) {

    const today = new Date();

    today.setHours(0, 0, 0, 0);


    const deadlineDate =
        new Date(dateString + "T00:00:00");


    return deadlineDate < today;

}


// ================================
// SECURITY
// ================================

function escapeHTML(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}


// ================================
// INITIALIZE
// ================================

renderTasks();